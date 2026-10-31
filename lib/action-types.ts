import type { FxRates } from "@/lib/money";
import type { ActionResult as Base } from "@/lib/types";

export type ActionResult<T = undefined> = Base<T>;
export type FxRatesResult = Base<FxRates>;
