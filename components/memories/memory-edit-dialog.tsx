"use client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateMemory } from "@/actions/memories";
import { memorySchema, type z } from "@/lib/validation";
import type { Memory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { SubmitButton } from "@/components/forms/form-bits";

type In = z.input<typeof memorySchema>;
type Out = z.output<typeof memorySchema>;

export function MemoryEditDialog({ memory, onOpenChange }: { memory: Memory; onOpenChange: (o: boolean) => void }) {
  const [pending, start] = useTransition();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(memorySchema),
    values: { trip_id: memory.trip_id, trip_country_id: memory.trip_country_id, city_id: memory.city_id, place_id: memory.place_id, date: memory.date, title: memory.title ?? "", body: memory.body ?? "", mood: memory.mood ?? "", tags: memory.tags },
  });
  const { register, handleSubmit, setValue, watch, formState } = form;
  const onSubmit = handleSubmit((v) =>
    start(async () => {
      const res = await updateMemory(memory.id, v);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Memory updated");
      onOpenChange(false);
    }),
  );
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title="Edit memory"
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton form="memory-edit" pending={pending}>
            Save
          </SubmitButton>
        </>
      }
    >
      <form id="memory-edit" onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
        <Field label="Title" htmlFor="me-title">
          <Input id="me-title" {...register("title")} />
        </Field>
        <Field label="Text (markdown)" htmlFor="me-body">
          <Textarea id="me-body" rows={8} {...register("body")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="me-date" error={formState.errors.date?.message}>
            <Input id="me-date" type="date" {...register("date")} />
          </Field>
          <Field label="Mood" htmlFor="me-mood">
            <Input id="me-mood" maxLength={8} {...register("mood")} />
          </Field>
        </div>
        <Field label="Tags (comma separated)" htmlFor="me-tags">
          <Input
            id="me-tags"
            defaultValue={(watch("tags") ?? []).join(", ")}
            onChange={(e) =>
              setValue(
                "tags",
                e.target.value
                  .split(",")
                  .map((t) => t.trim().replace(/^#/, "").toLowerCase())
                  .filter(Boolean),
              )
            }
          />
        </Field>
      </form>
    </ResponsiveDialog>
  );
}
