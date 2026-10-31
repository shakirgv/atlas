
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
            "bookings": {
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
                },"cities": {
                  Row: {
                    "arrive_date": string | null,"cover_path": string | null,"created_at": string,"depart_date": string | null,"id": string,"lat": number | null,"lng": number | null,"name": string,"notes": string | null,"order_index": number,"status": string,"trip_country_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arrive_date"?: string | null,"cover_path"?: string | null,"created_at"?: string,"depart_date"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name": string,"notes"?: string | null,"order_index"?: number,"status"?: string,"trip_country_id": string,"user_id"?: string
                  }
                  Update: {
                    "arrive_date"?: string | null,"cover_path"?: string | null,"created_at"?: string,"depart_date"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name"?: string,"notes"?: string | null,"order_index"?: number,"status"?: string,"trip_country_id"?: string,"user_id"?: string
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
                },"documents": {
                  Row: {
                    "created_at": string,"expiry_date": string | null,"file_name": string | null,"file_path": string | null,"id": string,"is_sample": boolean,"issue_date": string | null,"mime_type": string | null,"notes": string | null,"reference_no": string | null,"size_bytes": number | null,"title": string,"trip_country_id": string | null,"trip_id": string | null,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expiry_date"?: string | null,"file_name"?: string | null,"file_path"?: string | null,"id"?: string,"is_sample"?: boolean,"issue_date"?: string | null,"mime_type"?: string | null,"notes"?: string | null,"reference_no"?: string | null,"size_bytes"?: number | null,"title": string,"trip_country_id"?: string | null,"trip_id"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"expiry_date"?: string | null,"file_name"?: string | null,"file_path"?: string | null,"id"?: string,"is_sample"?: boolean,"issue_date"?: string | null,"mime_type"?: string | null,"notes"?: string | null,"reference_no"?: string | null,"size_bytes"?: number | null,"title"?: string,"trip_country_id"?: string | null,"trip_id"?: string | null,"type"?: string,"user_id"?: string
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
                },"expenses": {
                  Row: {
                    "amount": number,"amount_base": number,"category": string,"city_id": string | null,"created_at": string,"currency": string,"date": string,"fx_rate": number,"id": string,"kind": string,"notes": string | null,"title": string | null,"trip_country_id": string | null,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"amount_base": number,"category"?: string,"city_id"?: string | null,"created_at"?: string,"currency"?: string,"date"?: string,"fx_rate"?: number,"id"?: string,"kind"?: string,"notes"?: string | null,"title"?: string | null,"trip_country_id"?: string | null,"trip_id": string,"user_id"?: string
                  }
                  Update: {
                    "amount"?: number,"amount_base"?: number,"category"?: string,"city_id"?: string | null,"created_at"?: string,"currency"?: string,"date"?: string,"fx_rate"?: number,"id"?: string,"kind"?: string,"notes"?: string | null,"title"?: string | null,"trip_country_id"?: string | null,"trip_id"?: string,"user_id"?: string
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
                    "body": string | null,"city_id": string | null,"created_at": string,"date": string,"id": string,"mood": string | null,"place_id": string | null,"tags": (string)[],"title": string | null,"trip_country_id": string | null,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"city_id"?: string | null,"created_at"?: string,"date"?: string,"id"?: string,"mood"?: string | null,"place_id"?: string | null,"tags"?: (string)[],"title"?: string | null,"trip_country_id"?: string | null,"trip_id": string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string | null,"city_id"?: string | null,"created_at"?: string,"date"?: string,"id"?: string,"mood"?: string | null,"place_id"?: string | null,"tags"?: (string)[],"title"?: string | null,"trip_country_id"?: string | null,"trip_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memories_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
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
                    "base_currency": string,"created_at": string,"display_name": string | null,"theme": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_currency"?: string,"created_at"?: string,"display_name"?: string | null,"theme"?: string,"user_id"?: string
                  }
                  Update: {
                    "base_currency"?: string,"created_at"?: string,"display_name"?: string | null,"theme"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"trip_countries": {
                  Row: {
                    "arrive_date": string | null,"budget": number | null,"country_code": string,"cover_path": string | null,"created_at": string,"depart_date": string | null,"id": string,"notes": string | null,"order_index": number,"status": string,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arrive_date"?: string | null,"budget"?: number | null,"country_code": string,"cover_path"?: string | null,"created_at"?: string,"depart_date"?: string | null,"id"?: string,"notes"?: string | null,"order_index"?: number,"status"?: string,"trip_id": string,"user_id"?: string
                  }
                  Update: {
                    "arrive_date"?: string | null,"budget"?: number | null,"country_code"?: string,"cover_path"?: string | null,"created_at"?: string,"depart_date"?: string | null,"id"?: string,"notes"?: string | null,"order_index"?: number,"status"?: string,"trip_id"?: string,"user_id"?: string
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
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
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
