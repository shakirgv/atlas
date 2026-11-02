"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { photoMetaSchema, type PhotoMeta } from "@/lib/validation";
import { removeFiles } from "@/lib/storage";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import { PHOTO_ENTITY_TYPES, type ActionResult, type PhotoEntityType } from "@/lib/types";

const TABLE: Record<PhotoEntityType, "trips" | "trip_countries" | "cities" | "places" | null> = {
  trip: "trips",
  country: "trip_countries",
  city: "cities",
  place: "places",
  memory: null,
  expense: null,
};

/** Save photo rows after the browser uploaded the files to Storage. */
export async function savePhotos(
  entityType: PhotoEntityType,
  entityId: string,
  photos: PhotoMeta[],
  opts: { setCover?: boolean } = {},
): Promise<ActionResult<{ ids: string[] }>> {
  try {
    const { supabase, user } = await requireUser();
    const type = z.enum(PHOTO_ENTITY_TYPES).parse(entityType);
    const eid = z.uuid().parse(entityId);
    const list = z.array(photoMetaSchema).min(1).max(50).parse(photos);
    const prefix = `${user.id}/${type}/${eid}/`;
    if (list.some((p) => !p.path.startsWith(prefix) || (p.thumb_path && !p.thumb_path.startsWith(prefix)))) {
      throw new Error("Invalid upload path");
    }
    const existing = must(await supabase.from("photos").select("order_index").eq("entity_id", eid).order("order_index", { ascending: false }).limit(1));
    let next = (existing[0]?.order_index ?? -1) + 1;
    const rows = must(
      await supabase
        .from("photos")
        .insert(list.map((p) => ({ ...p, caption: p.caption ?? null, entity_type: type, entity_id: eid, source: "upload", order_index: next++ })))
        .select("id"),
    );
    const table = TABLE[type];
    // Manual upload always overrides the cover.
    if (table && opts.setCover !== false) {
      must(await supabase.from(table).update({ cover_path: list[0]!.path }).eq("id", eid));
    }
    refreshAll();
    return ok({ ids: rows.map((r) => r.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function updatePhotoCaption(id: string, caption: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("photos").update({ caption: z.string().max(500).parse(caption) || null }).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Set a photo as the cover of its entity (or of the memory's trip). */
export async function setPhotoAsCover(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const photo = must(await supabase.from("photos").select("*").eq("id", z.uuid().parse(id)).single());
    const type = photo.entity_type as PhotoEntityType;
    if (type === "memory") {
      const mem = must(await supabase.from("memories").select("trip_id, city_id, trip_country_id").eq("id", photo.entity_id).single());
      if (mem.city_id) must(await supabase.from("cities").update({ cover_path: photo.path }).eq("id", mem.city_id));
      else if (mem.trip_country_id) must(await supabase.from("trip_countries").update({ cover_path: photo.path }).eq("id", mem.trip_country_id));
      else must(await supabase.from("trips").update({ cover_path: photo.path }).eq("id", mem.trip_id));
    } else {
      const table = TABLE[type]!;
      must(await supabase.from(table).update({ cover_path: photo.path }).eq("id", photo.entity_id));
    }
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deletePhoto(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const photo = must(await supabase.from("photos").select("*").eq("id", z.uuid().parse(id)).single());
    must(await supabase.from("photos").delete().eq("id", photo.id));
    await removeFiles(supabase, "photos", [photo.path, photo.thumb_path]);
    // Clear covers that pointed at this file.
    await Promise.all(
      (["trips", "trip_countries", "cities", "places"] as const).map((t) => supabase.from(t).update({ cover_path: null }).eq("cover_path", photo.path)),
    );
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
