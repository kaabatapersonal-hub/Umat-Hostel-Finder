// Hand-authored to match supabase/migrations/*.sql exactly.
// Once migrations are applied, regenerate the source of truth with:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/lib/supabase/database.types.ts
// and diff against this file before committing, to catch schema drift.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      hostels: {
        Row: {
          id: string;
          owner_id: string | null;
          name: string;
          room_types: Json;
          price_min: number | null;
          price_max: number | null;
          location: string;
          distance_text: string | null;
          latitude: number | null;
          longitude: number | null;
          description: string | null;
          // Array of { url: string, blurDataURL: string | null }.
          images: Json;
          facilities: string[];
          contact: string;
          call_number: string | null;
          whatsapp_group: string | null;
          tags: string[];
          availability: string;
          availability_updated_at: string;
          featured: boolean;
          featured_until: string | null;
          is_paid: boolean;
          rating_avg: number;
          rating_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          name: string;
          // price_min/price_max are trigger-maintained from room_types —
          // don't set them directly.
          room_types?: Json;
          price_min?: number | null;
          price_max?: number | null;
          location: string;
          distance_text?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          description?: string | null;
          images?: Json;
          facilities?: string[];
          contact: string;
          call_number?: string | null;
          whatsapp_group?: string | null;
          tags?: string[];
          availability?: string;
          availability_updated_at?: string;
          featured?: boolean;
          featured_until?: string | null;
          is_paid?: boolean;
          rating_avg?: number;
          rating_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          name?: string;
          room_types?: Json;
          price_min?: number | null;
          price_max?: number | null;
          location?: string;
          distance_text?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          description?: string | null;
          images?: Json;
          facilities?: string[];
          contact?: string;
          call_number?: string | null;
          whatsapp_group?: string | null;
          tags?: string[];
          availability?: string;
          availability_updated_at?: string;
          featured?: boolean;
          featured_until?: string | null;
          is_paid?: boolean;
          rating_avg?: number;
          rating_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hostels_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      submissions: {
        Row: {
          id: string;
          submitted_by: string;
          name: string;
          location: string;
          distance_text: string | null;
          description: string | null;
          room_types: Json;
          price_min: number | null;
          price_max: number | null;
          contact: string;
          call_number: string | null;
          latitude: number | null;
          longitude: number | null;
          images: Json;
          facilities: string[];
          tags: string[];
          status: string;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submitted_by: string;
          name: string;
          location: string;
          distance_text?: string | null;
          description?: string | null;
          room_types?: Json;
          price_min?: number | null;
          price_max?: number | null;
          contact: string;
          call_number?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          images?: Json;
          facilities?: string[];
          tags?: string[];
          status?: string;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          submitted_by?: string;
          name?: string;
          location?: string;
          distance_text?: string | null;
          description?: string | null;
          room_types?: Json;
          price_min?: number | null;
          price_max?: number | null;
          contact?: string;
          call_number?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          images?: Json;
          facilities?: string[];
          tags?: string[];
          status?: string;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submissions_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          hostel_id: string;
          author_id: string;
          rating: number;
          comment: string;
          reviewer_name: string | null;
          is_resident: boolean;
          reported: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hostel_id: string;
          author_id: string;
          rating: number;
          comment: string;
          reviewer_name?: string | null;
          is_resident?: boolean;
          reported?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          hostel_id?: string;
          author_id?: string;
          rating?: number;
          comment?: string;
          reviewer_name?: string | null;
          is_resident?: boolean;
          reported?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_hostel_id_fkey";
            columns: ["hostel_id"];
            isOneToOne: false;
            referencedRelation: "hostels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_hostels: {
        Row: {
          id: string;
          user_id: string;
          hostel_id: string;
          hostel_name: string | null;
          hostel_price_min: number | null;
          hostel_price_max: number | null;
          hostel_location: string | null;
          hostel_image_url: string | null;
          hostel_image_blur: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          hostel_id: string;
          hostel_name?: string | null;
          hostel_price_min?: number | null;
          hostel_price_max?: number | null;
          hostel_location?: string | null;
          hostel_image_url?: string | null;
          hostel_image_blur?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          hostel_id?: string;
          hostel_name?: string | null;
          hostel_price_min?: number | null;
          hostel_price_max?: number | null;
          hostel_location?: string | null;
          hostel_image_url?: string | null;
          hostel_image_blur?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_hostels_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_hostels_hostel_id_fkey";
            columns: ["hostel_id"];
            isOneToOne: false;
            referencedRelation: "hostels";
            referencedColumns: ["id"];
          },
        ];
      };
      roommate_profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          whatsapp: string;
          budget: string | null;
          room_type: string | null;
          preferred_location: string | null;
          sleep_time: string | null;
          cleanliness: string | null;
          study_habits: string | null;
          gender: string | null;
          about: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          whatsapp: string;
          budget?: string | null;
          room_type?: string | null;
          preferred_location?: string | null;
          sleep_time?: string | null;
          cleanliness?: string | null;
          study_habits?: string | null;
          gender?: string | null;
          about?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          display_name?: string;
          whatsapp?: string;
          budget?: string | null;
          room_type?: string | null;
          preferred_location?: string | null;
          sleep_time?: string | null;
          cleanliness?: string | null;
          study_habits?: string | null;
          gender?: string | null;
          about?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roommate_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      roommate_requests: {
        Row: {
          id: string;
          from_profile_id: string;
          to_profile_id: string;
          from_user_id: string;
          to_user_id: string;
          from_name: string;
          to_name: string;
          message: string | null;
          status: string;
          from_whatsapp: string | null;
          to_whatsapp: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          from_profile_id: string;
          to_profile_id: string;
          from_user_id: string;
          to_user_id: string;
          from_name: string;
          to_name: string;
          message?: string | null;
          status?: string;
          from_whatsapp?: string | null;
          to_whatsapp?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          from_profile_id?: string;
          to_profile_id?: string;
          from_user_id?: string;
          to_user_id?: string;
          from_name?: string;
          to_name?: string;
          message?: string | null;
          status?: string;
          from_whatsapp?: string | null;
          to_whatsapp?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roommate_requests_from_profile_id_fkey";
            columns: ["from_profile_id"];
            isOneToOne: false;
            referencedRelation: "roommate_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roommate_requests_to_profile_id_fkey";
            columns: ["to_profile_id"];
            isOneToOne: false;
            referencedRelation: "roommate_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roommate_requests_from_user_id_fkey";
            columns: ["from_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roommate_requests_to_user_id_fkey";
            columns: ["to_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      recalculate_hostel_rating: {
        Args: { p_hostel_id: string };
        Returns: undefined;
      };
      report_review: {
        Args: { p_review_id: string };
        Returns: undefined;
      };
      get_hostel_feed: {
        Args: {
          p_search?: string | null;
          p_near_campus?: boolean;
          p_under_budget?: boolean;
          p_available_now?: boolean;
          p_featured_only?: boolean;
          p_en_suite?: boolean;
          p_cursor_featured?: boolean | null;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
          p_limit?: number;
        };
        Returns: {
          id: string;
          name: string;
          price_min: number | null;
          price_max: number | null;
          location: string;
          distance_text: string | null;
          images: Json;
          tags: string[];
          availability: string;
          rating_avg: number;
          rating_count: number;
          featured: boolean;
          featured_until: string | null;
          created_at: string;
          is_actively_featured: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience literal-union aliases for the text+CHECK "enums" above.
// The generated Database type models these columns as plain `string`
// (Postgres CHECK constraints aren't reflected as TS literal unions), so use
// these when you want compile-time narrowing in app code.
// Room type keys live in lib/room-types.ts (RoomTypeKey) since, as of
// Session 4.5, hostels.room_types is a jsonb array — not a plain enum
// column — and the per-element shape is an application concern, not a
// generated-database-types one.
export type Availability = "available" | "filling" | "full";
export type ProfileRole = "student" | "admin";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type RoommateRequestStatus = "pending" | "accepted" | "declined";
