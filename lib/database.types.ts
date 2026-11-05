
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "country_reviews": {
                  Row: {
                    "best_experience": string | null,"best_food": string | null,"completed_at": string | null,"created_at": string,"dismissed_at": string | null,"enough_days": number | null,"id": string,"next_visit": string[],"overpriced": string | null,"recommended_hotel": string | null,"return_again": string | null,"trip_country_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "best_experience"?: string | null,"best_food"?: string | null,"completed_at"?: string | null,"created_at"?: string,"dismissed_at"?: string | null,"enough_days"?: number | null,"id"?: string,"next_visit"?: string[],"overpriced"?: string | null,"recommended_hotel"?: string | null,"return_again"?: string | null,"trip_country_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "best_experience"?: string | null,"best_food"?: string | null,"completed_at"?: string | null,"created_at"?: string,"dismissed_at"?: string | null,"enough_days"?: number | null,"id"?: string,"next_visit"?: string[],"overpriced"?: string | null,"recommended_hotel"?: string | null,"return_again"?: string | null,"trip_country_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "country_reviews_trip_country_id_fkey"
      columns: ["trip_country_id"]
isOneToOne: true
      referencedRelation: "trip_countries"
      referencedColumns: ["id"]
    }
                  ]
                },"date_shifts": {
                  Row: {
                    "changes": Json,"created_at": string,"days": number,"id": string,"label": string,"trip_id": string,"undone_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changes": Json,"created_at"?: string,"days": number,"id"?: string,"label": string,"trip_id": string,"undone_at"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "changes"?: Json,"created_at"?: string,"days"?: number,"id"?: string,"label"?: string,"trip_id"?: string,"undone_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "date_shifts_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "city_id": string | null,"confirmation_no": string | null,"cost": number | null,"created_at": string,"currency": string | null,"document_id": string | null,"end_at": string | null,"from_label": string | null,"id": string,"start_at": string | null,"status": string,"title": string,"to_label": string | null,"trip_country_id": string | null,"trip_id": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city_id"?: string | null,"confirmation_no"?: string | null,"cost"?: number | null,"created_at"?: string,"currency"?: string | null,"document_id"?: string | null,"end_at"?: string | null,"from_label"?: string | null,"id"?: string,"start_at"?: string | null,"status"?: string,"title": string,"to_label"?: string | null,"trip_country_id"?: string | null,"trip_id": string,"type"?: string,"user_id"?: string
                  }
                  Update: {
                    "city_id"?: string | null,"confirmation_no"?: string | null,"cost"?: number | null,"created_at"?: string,"currency"?: string | null,"document_id"?: string | null,"end_at"?: string | null,"from_label"?: string | null,"id"?: string,"start_at"?: string | null,"status"?: string,"title"?: string,"to_label"?: string | null,"trip_country_id"?: string | null,"trip_id"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_trip_country_id_fkey"
      columns: ["trip_country_id"]
isOneToOne: false
      referencedRelation: "trip_countries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"cash_transactions": {
                  Row: {
                    "amount": number,"counter_amount": number | null,"counter_currency": string | null,"created_at": string,"date": string,"effective_rate": number | null,"expense_id": string | null,"fee_amount": number | null,"fee_currency": string | null,"fee_expense_id": string | null,"id": string,"linked_transaction_id": string | null,"mid_market_rate": number | null,"note": string | null,"type": string,"user_id": string,"wallet_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"counter_amount"?: number | null,"counter_currency"?: string | null,"created_at"?: string,"date"?: string,"effective_rate"?: number | null,"expense_id"?: string | null,"fee_amount"?: number | null,"fee_currency"?: string | null,"fee_expense_id"?: string | null,"id"?: string,"linked_transaction_id"?: string | null,"mid_market_rate"?: number | null,"note"?: string | null,"type": string,"user_id"?: string,"wallet_id": string
                  }
                  Update: {
                    "amount"?: number,"counter_amount"?: number | null,"counter_currency"?: string | null,"created_at"?: string,"date"?: string,"effective_rate"?: number | null,"expense_id"?: string | null,"fee_amount"?: number | null,"fee_currency"?: string | null,"fee_expense_id"?: string | null,"id"?: string,"linked_transaction_id"?: string | null,"mid_market_rate"?: number | null,"note"?: string | null,"type"?: string,"user_id"?: string,"wallet_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_transactions_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_transactions_fee_expense_id_fkey"
      columns: ["fee_expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_transactions_wallet_id_fkey"
      columns: ["wallet_id"]
isOneToOne: false
      referencedRelation: "cash_wallets"
      referencedColumns: ["id"]
    }
                  ]
                },"cash_wallets": {
                  Row: {
                    "created_at": string,"currency": string,"id": string,"label": string | null,"low_balance_alert": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency": string,"id"?: string,"label"?: string | null,"low_balance_alert"?: number | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"id"?: string,"label"?: string | null,"low_balance_alert"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cities": {
                  Row: {
                    "arrive_date": string | null,"cover_path": string | null,"created_at": string,"depart_date": string | null,"id": string,"lat": number | null,"lng": number | null,"name": string,"notes": string | null,"order_index": number,"status": string,"timezone": string | null,"transport_mode": string | null,"transport_note": string | null,"trip_country_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arrive_date"?: string | null,"cover_path"?: string | null,"created_at"?: string,"depart_date"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name": string,"notes"?: string | null,"order_index"?: number,"status"?: string,"timezone"?: string | null,"transport_mode"?: string | null,"transport_note"?: string | null,"trip_country_id": string,"user_id"?: string
                  }
                  Update: {
                    "arrive_date"?: string | null,"cover_path"?: string | null,"created_at"?: string,"depart_date"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name"?: string,"notes"?: string | null,"order_index"?: number,"status"?: string,"timezone"?: string | null,"transport_mode"?: string | null,"transport_note"?: string | null,"trip_country_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cities_trip_country_id_fkey"
      columns: ["trip_country_id"]
isOneToOne: false
      referencedRelation: "trip_countries"
      referencedColumns: ["id"]
    }
                  ]
                },"country_info_overrides": {
                  Row: {
                    "country_code": string,"created_at": string,"embassy_address": string | null,"embassy_name": string | null,"embassy_phone": string | null,"embassy_url": string | null,"emergency_ambulance": string | null,"emergency_fire": string | null,"emergency_general": string | null,"emergency_police": string | null,"frequency": string | null,"id": string,"notes": string | null,"plugs": (string)[] | null,"sim_tips": string | null,"tap_water": string | null,"tipping": string | null,"user_id": string,"voltage": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country_code": string,"created_at"?: string,"embassy_address"?: string | null,"embassy_name"?: string | null,"embassy_phone"?: string | null,"embassy_url"?: string | null,"emergency_ambulance"?: string | null,"emergency_fire"?: string | null,"emergency_general"?: string | null,"emergency_police"?: string | null,"frequency"?: string | null,"id"?: string,"notes"?: string | null,"plugs"?: (string)[] | null,"sim_tips"?: string | null,"tap_water"?: string | null,"tipping"?: string | null,"user_id"?: string,"voltage"?: string | null
                  }
                  Update: {
                    "country_code"?: string,"created_at"?: string,"embassy_address"?: string | null,"embassy_name"?: string | null,"embassy_phone"?: string | null,"embassy_url"?: string | null,"emergency_ambulance"?: string | null,"emergency_fire"?: string | null,"emergency_general"?: string | null,"emergency_police"?: string | null,"frequency"?: string | null,"id"?: string,"notes"?: string | null,"plugs"?: (string)[] | null,"sim_tips"?: string | null,"tap_water"?: string | null,"tipping"?: string | null,"user_id"?: string,"voltage"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"documents": {
                  Row: {
                    "created_at": string,"expiry_date": string | null,"file_name": string | null,"file_path": string | null,"id": string,"is_sample": boolean,"issue_date": string | null,"mime_type": string | null,"notes": string | null,"reference_no": string | null,"sensitive": boolean,"size_bytes": number | null,"title": string,"trip_country_id": string | null,"trip_id": string | null,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expiry_date"?: string | null,"file_name"?: string | null,"file_path"?: string | null,"id"?: string,"is_sample"?: boolean,"issue_date"?: string | null,"mime_type"?: string | null,"notes"?: string | null,"reference_no"?: string | null,"sensitive"?: boolean,"size_bytes"?: number | null,"title": string,"trip_country_id"?: string | null,"trip_id"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"expiry_date"?: string | null,"file_name"?: string | null,"file_path"?: string | null,"id"?: string,"is_sample"?: boolean,"issue_date"?: string | null,"mime_type"?: string | null,"notes"?: string | null,"reference_no"?: string | null,"sensitive"?: boolean,"size_bytes"?: number | null,"title"?: string,"trip_country_id"?: string | null,"trip_id"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_trip_country_id_fkey"
      columns: ["trip_country_id"]
isOneToOne: false
      referencedRelation: "trip_countries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"entry_requirements": {
                  Row: {
                    "allowed_stay_days": number | null,"applied_on": string | null,"apply_by": string | null,"checklist": NonNullable<Json>,"country_code": string,"created_at": string,"document_id": string | null,"fee": number | null,"fee_currency": string | null,"id": string,"last_verified_on": string | null,"notes": string | null,"official_url": string | null,"passport_country": string | null,"requirement_type": string,"status": string,"trip_country_id": string,"user_id": string,"valid_from": string | null,"valid_until": string | null,"validity_rule_from": string | null,"validity_rule_months": number | null,"validity_rule_passport": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_stay_days"?: number | null,"applied_on"?: string | null,"apply_by"?: string | null,"checklist"?: NonNullable<Json>,"country_code": string,"created_at"?: string,"document_id"?: string | null,"fee"?: number | null,"fee_currency"?: string | null,"id"?: string,"last_verified_on"?: string | null,"notes"?: string | null,"official_url"?: string | null,"passport_country"?: string | null,"requirement_type"?: string,"status"?: string,"trip_country_id": string,"user_id"?: string,"valid_from"?: string | null,"valid_until"?: string | null,"validity_rule_from"?: string | null,"validity_rule_months"?: number | null,"validity_rule_passport"?: string | null
                  }
                  Update: {
                    "allowed_stay_days"?: number | null,"applied_on"?: string | null,"apply_by"?: string | null,"checklist"?: NonNullable<Json>,"country_code"?: string,"created_at"?: string,"document_id"?: string | null,"fee"?: number | null,"fee_currency"?: string | null,"id"?: string,"last_verified_on"?: string | null,"notes"?: string | null,"official_url"?: string | null,"passport_country"?: string | null,"requirement_type"?: string,"status"?: string,"trip_country_id"?: string,"user_id"?: string,"valid_from"?: string | null,"valid_until"?: string | null,"validity_rule_from"?: string | null,"validity_rule_months"?: number | null,"validity_rule_passport"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "entry_requirements_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entry_requirements_trip_country_id_fkey"
      columns: ["trip_country_id"]
isOneToOne: true
      referencedRelation: "trip_countries"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"amount_base": number,"category": string,"city_id": string | null,"created_at": string,"currency": string,"date": string,"fx_rate": number,"id": string,"kind": string,"notes": string | null,"payment_method": string,"title": string | null,"trip_country_id": string | null,"trip_id": string,"user_id": string,"wallet_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"amount_base": number,"category"?: string,"city_id"?: string | null,"created_at"?: string,"currency"?: string,"date"?: string,"fx_rate"?: number,"id"?: string,"kind"?: string,"notes"?: string | null,"payment_method"?: string,"title"?: string | null,"trip_country_id"?: string | null,"trip_id": string,"user_id"?: string,"wallet_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"amount_base"?: number,"category"?: string,"city_id"?: string | null,"created_at"?: string,"currency"?: string,"date"?: string,"fx_rate"?: number,"id"?: string,"kind"?: string,"notes"?: string | null,"payment_method"?: string,"title"?: string | null,"trip_country_id"?: string | null,"trip_id"?: string,"user_id"?: string,"wallet_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_trip_country_id_fkey"
      columns: ["trip_country_id"]
isOneToOne: false
      referencedRelation: "trip_countries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_wallet_id_fkey"
      columns: ["wallet_id"]
isOneToOne: false
      referencedRelation: "cash_wallets"
      referencedColumns: ["id"]
    }
                  ]
                },"itinerary_days": {
                  Row: {
                    "city_id": string | null,"created_at": string,"date": string | null,"day_number": number,"id": string,"notes": string | null,"title": string | null,"trip_country_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city_id"?: string | null,"created_at"?: string,"date"?: string | null,"day_number": number,"id"?: string,"notes"?: string | null,"title"?: string | null,"trip_country_id": string,"user_id"?: string
                  }
                  Update: {
                    "city_id"?: string | null,"created_at"?: string,"date"?: string | null,"day_number"?: number,"id"?: string,"notes"?: string | null,"title"?: string | null,"trip_country_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "itinerary_days_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "itinerary_days_trip_country_id_fkey"
      columns: ["trip_country_id"]
isOneToOne: false
      referencedRelation: "trip_countries"
      referencedColumns: ["id"]
    }
                  ]
                },"itinerary_items": {
                  Row: {
                    "created_at": string,"day_id": string,"done": boolean,"end_time": string | null,"id": string,"notes": string | null,"order_index": number,"place_id": string | null,"start_time": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_id": string,"done"?: boolean,"end_time"?: string | null,"id"?: string,"notes"?: string | null,"order_index"?: number,"place_id"?: string | null,"start_time"?: string | null,"title": string,"type"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"day_id"?: string,"done"?: boolean,"end_time"?: string | null,"id"?: string,"notes"?: string | null,"order_index"?: number,"place_id"?: string | null,"start_time"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "itinerary_items_day_id_fkey"
      columns: ["day_id"]
isOneToOne: false
      referencedRelation: "itinerary_days"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "itinerary_items_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"memories": {
                  Row: {
                    "body": string | null,"city_id": string | null,"created_at": string,"date": string,"id": string,"itinerary_day_id": string | null,"mood": string | null,"place_id": string | null,"tags": (string)[],"title": string | null,"trip_country_id": string | null,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"city_id"?: string | null,"created_at"?: string,"date"?: string,"id"?: string,"itinerary_day_id"?: string | null,"mood"?: string | null,"place_id"?: string | null,"tags"?: (string)[],"title"?: string | null,"trip_country_id"?: string | null,"trip_id": string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string | null,"city_id"?: string | null,"created_at"?: string,"date"?: string,"id"?: string,"itinerary_day_id"?: string | null,"mood"?: string | null,"place_id"?: string | null,"tags"?: (string)[],"title"?: string | null,"trip_country_id"?: string | null,"trip_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memories_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memories_itinerary_day_id_fkey"
      columns: ["itinerary_day_id"]
isOneToOne: false
      referencedRelation: "itinerary_days"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memories_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memories_trip_country_id_fkey"
      columns: ["trip_country_id"]
isOneToOne: false
      referencedRelation: "trip_countries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memories_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"packing_items": {
                  Row: {
                    "category": string,"created_at": string,"id": string,"label": string,"order_index": number,"packed": boolean,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"created_at"?: string,"id"?: string,"label": string,"order_index"?: number,"packed"?: boolean,"trip_id": string,"user_id"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"id"?: string,"label"?: string,"order_index"?: number,"packed"?: boolean,"trip_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "packing_items_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"packing_templates": {
                  Row: {
                    "created_at": string,"id": string,"items": NonNullable<Json>,"name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"items"?: NonNullable<Json>,"name": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"items"?: NonNullable<Json>,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"photos": {
                  Row: {
                    "attribution": string | null,"caption": string | null,"created_at": string,"entity_id": string,"entity_type": string,"height": number | null,"id": string,"lat": number | null,"lng": number | null,"order_index": number,"path": string,"source": string,"taken_at": string | null,"thumb_path": string | null,"user_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attribution"?: string | null,"caption"?: string | null,"created_at"?: string,"entity_id": string,"entity_type": string,"height"?: number | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"order_index"?: number,"path": string,"source"?: string,"taken_at"?: string | null,"thumb_path"?: string | null,"user_id"?: string,"width"?: number | null
                  }
                  Update: {
                    "attribution"?: string | null,"caption"?: string | null,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"height"?: number | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"order_index"?: number,"path"?: string,"source"?: string,"taken_at"?: string | null,"thumb_path"?: string | null,"user_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"places": {
                  Row: {
                    "address": string | null,"category": string,"city_id": string,"cost_currency": string | null,"cost_estimate": number | null,"cover_path": string | null,"created_at": string,"id": string,"lat": number | null,"lng": number | null,"name": string,"notes": string | null,"opening_hours": string | null,"rating": number | null,"status": string,"url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"category"?: string,"city_id": string,"cost_currency"?: string | null,"cost_estimate"?: number | null,"cover_path"?: string | null,"created_at"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name": string,"notes"?: string | null,"opening_hours"?: string | null,"rating"?: number | null,"status"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "address"?: string | null,"category"?: string,"city_id"?: string,"cost_currency"?: string | null,"cost_estimate"?: number | null,"cover_path"?: string | null,"created_at"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name"?: string,"notes"?: string | null,"opening_hours"?: string | null,"rating"?: number | null,"status"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "places_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "base_currency": string,"created_at": string,"display_name": string | null,"home_city": string | null,"home_lat": number | null,"home_lng": number | null,"home_timezone": string | null,"lock_timeout_minutes": number,"passport_country": string | null,"theme": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_currency"?: string,"created_at"?: string,"display_name"?: string | null,"home_city"?: string | null,"home_lat"?: number | null,"home_lng"?: number | null,"home_timezone"?: string | null,"lock_timeout_minutes"?: number,"passport_country"?: string | null,"theme"?: string,"user_id"?: string
                  }
                  Update: {
                    "base_currency"?: string,"created_at"?: string,"display_name"?: string | null,"home_city"?: string | null,"home_lat"?: number | null,"home_lng"?: number | null,"home_timezone"?: string | null,"lock_timeout_minutes"?: number,"passport_country"?: string | null,"theme"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"shares": {
                  Row: {
                    "config": NonNullable<Json>,"created_at": string,"expires_at": string | null,"id": string,"kind": string,"last_viewed_at": string | null,"revoked_at": string | null,"target_id": string | null,"token": string,"user_id": string,"view_count": number,"year": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"kind": string,"last_viewed_at"?: string | null,"revoked_at"?: string | null,"target_id"?: string | null,"token": string,"user_id"?: string,"view_count"?: number,"year"?: number | null
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"kind"?: string,"last_viewed_at"?: string | null,"revoked_at"?: string | null,"target_id"?: string | null,"token"?: string,"user_id"?: string,"view_count"?: number,"year"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"trip_countries": {
                  Row: {
                    "arrive_date": string | null,"budget": number | null,"country_code": string,"cover_path": string | null,"created_at": string,"depart_date": string | null,"id": string,"notes": string | null,"order_index": number,"status": string,"transport_mode": string | null,"transport_note": string | null,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arrive_date"?: string | null,"budget"?: number | null,"country_code": string,"cover_path"?: string | null,"created_at"?: string,"depart_date"?: string | null,"id"?: string,"notes"?: string | null,"order_index"?: number,"status"?: string,"transport_mode"?: string | null,"transport_note"?: string | null,"trip_id": string,"user_id"?: string
                  }
                  Update: {
                    "arrive_date"?: string | null,"budget"?: number | null,"country_code"?: string,"cover_path"?: string | null,"created_at"?: string,"depart_date"?: string | null,"id"?: string,"notes"?: string | null,"order_index"?: number,"status"?: string,"transport_mode"?: string | null,"transport_note"?: string | null,"trip_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_countries_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trips": {
                  Row: {
                    "cover_path": string | null,"created_at": string,"description": string | null,"end_date": string | null,"id": string,"is_sample": boolean,"start_date": string | null,"status": string,"title": string,"total_budget": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"end_date"?: string | null,"id"?: string,"is_sample"?: boolean,"start_date"?: string | null,"status"?: string,"title": string,"total_budget"?: number | null,"user_id"?: string
                  }
                  Update: {
                    "cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"end_date"?: string | null,"id"?: string,"is_sample"?: boolean,"start_date"?: string | null,"status"?: string,"title"?: string,"total_budget"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"vault_secrets": {
                  Row: {
                    "created_at": string,"pin_failed_attempts": number,"pin_hash": string | null,"pin_length": number | null,"pin_locked_until": string | null,"pin_salt": string | null,"unlock_token_hash": string | null,"unlock_until": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"pin_failed_attempts"?: number,"pin_hash"?: string | null,"pin_length"?: number | null,"pin_locked_until"?: string | null,"pin_salt"?: string | null,"unlock_token_hash"?: string | null,"unlock_until"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"pin_failed_attempts"?: number,"pin_hash"?: string | null,"pin_length"?: number | null,"pin_locked_until"?: string | null,"pin_salt"?: string | null,"unlock_token_hash"?: string | null,"unlock_until"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "atlas_apply_date_shift":
{ Args: { "p_changes": Json,"p_days": number,"p_label": string,"p_trip_id": string }; Returns: string
                           },
"atlas_undo_date_shift":
{ Args: { "p_id": string }; Returns: Json
                           },
"atlas_document_open":
{ Args: { "p_path": string }; Returns: boolean
                           },
"atlas_mfa_ok":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"atlas_pin_check":
{ Args: { "p_hash": string,"p_token_hash": string }; Returns: {
              "attempts_left": number,"locked_until": string | null,"ok": boolean
            }[]
                           },
"atlas_pin_set":
{ Args: { "p_hash": string | null,"p_length": number | null,"p_salt": string | null }; Returns: undefined
                           },
"atlas_vault_lock":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"atlas_vault_status":
{ Args: Record<PropertyKey, never>; Returns: {
              "has_pin": boolean,"locked_until": string | null,"pin_length": number | null,"pin_salt": string | null
            }[]
                           },
"atlas_vault_touch":
{ Args: { "p_token_hash": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
