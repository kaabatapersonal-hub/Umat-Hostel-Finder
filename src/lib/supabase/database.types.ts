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
          is_suspended: boolean;
          is_leaving_sale: boolean;
          leaving_date: string | null;
          is_verified: boolean;
          verification_label: string | null;
          is_super_admin: boolean;
          admin_permissions: Json;
          username: string | null;
          bio: string | null;
          whatsapp_number: string | null;
          phone_number: string | null;
          avatar_color: string | null;
          seller_rating_avg: number;
          seller_rating_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: string;
          is_suspended?: boolean;
          is_leaving_sale?: boolean;
          leaving_date?: string | null;
          is_verified?: boolean;
          verification_label?: string | null;
          is_super_admin?: boolean;
          admin_permissions?: Json;
          username?: string | null;
          bio?: string | null;
          whatsapp_number?: string | null;
          phone_number?: string | null;
          avatar_color?: string | null;
          seller_rating_avg?: number;
          seller_rating_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: string;
          is_suspended?: boolean;
          is_leaving_sale?: boolean;
          leaving_date?: string | null;
          is_verified?: boolean;
          verification_label?: string | null;
          is_super_admin?: boolean;
          admin_permissions?: Json;
          username?: string | null;
          bio?: string | null;
          whatsapp_number?: string | null;
          phone_number?: string | null;
          avatar_color?: string | null;
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
          // The Session 8.5 edit-request buffer — null when no edit is
          // pending. Same snake_case shape as this row's own editable
          // columns; never read directly by student-facing UI.
          pending_changes: Json;
          has_pending_edit: boolean;
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
          pending_changes?: Json;
          has_pending_edit?: boolean;
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
          pending_changes?: Json;
          has_pending_edit?: boolean;
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
      seller_reviews: {
        Row: {
          id: string;
          seller_id: string;
          author_id: string;
          rating: number;
          comment: string;
          reviewer_name: string | null;
          reported: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          author_id: string;
          rating: number;
          comment: string;
          reviewer_name?: string | null;
          reported?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          seller_id?: string;
          author_id?: string;
          rating?: number;
          comment?: string;
          reviewer_name?: string | null;
          reported?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seller_reviews_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seller_reviews_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_market_listings: {
        Row: {
          id: string;
          user_id: string;
          listing_id: string;
          listing_title: string | null;
          listing_price: number | null;
          listing_image_url: string | null;
          listing_image_blur: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          listing_id: string;
          listing_title?: string | null;
          listing_price?: number | null;
          listing_image_url?: string | null;
          listing_image_blur?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          listing_id?: string;
          listing_title?: string | null;
          listing_price?: number | null;
          listing_image_url?: string | null;
          listing_image_blur?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_market_listings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_market_listings_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "market_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
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
      buzz_posts: {
        Row: {
          id: string;
          author_id: string;
          author_name: string | null;
          content: string;
          is_admin_post: boolean;
          is_pinned: boolean;
          reply_count: number;
          like_count: number;
          view_count: number;
          is_anonymous: boolean;
          author_avatar_color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          author_name?: string | null;
          content: string;
          is_admin_post?: boolean;
          is_pinned?: boolean;
          reply_count?: number;
          like_count?: number;
          view_count?: number;
          is_anonymous?: boolean;
          author_avatar_color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          author_name?: string | null;
          content?: string;
          is_admin_post?: boolean;
          is_pinned?: boolean;
          reply_count?: number;
          like_count?: number;
          view_count?: number;
          is_anonymous?: boolean;
          author_avatar_color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buzz_posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      buzz_replies: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          author_name: string | null;
          content: string;
          gif_url: string | null;
          author_avatar_color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          author_name?: string | null;
          content: string;
          gif_url?: string | null;
          author_avatar_color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          author_name?: string | null;
          content?: string;
          gif_url?: string | null;
          author_avatar_color?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buzz_replies_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "buzz_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buzz_replies_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      buzz_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buzz_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "buzz_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buzz_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      buzz_reports: {
        Row: {
          id: string;
          reporter_id: string;
          post_id: string | null;
          reply_id: string | null;
          reason: string;
          details: string | null;
          status: string;
          reviewed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          post_id?: string | null;
          reply_id?: string | null;
          reason: string;
          details?: string | null;
          status?: string;
          reviewed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          post_id?: string | null;
          reply_id?: string | null;
          reason?: string;
          details?: string | null;
          status?: string;
          reviewed_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buzz_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buzz_reports_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "buzz_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buzz_reports_reply_id_fkey";
            columns: ["reply_id"];
            isOneToOne: false;
            referencedRelation: "buzz_replies";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          type: string;
          title: string;
          body: string | null;
          actor_id: string | null;
          actor_name: string | null;
          reference_type: string | null;
          reference_id: string | null;
          link_url: string | null;
          group_key: string | null;
          group_count: number;
          is_read: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          type: string;
          title: string;
          body?: string | null;
          actor_id?: string | null;
          actor_name?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          link_url?: string | null;
          group_key?: string | null;
          group_count?: number;
          is_read?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          actor_id?: string | null;
          actor_name?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          link_url?: string | null;
          group_key?: string | null;
          group_count?: number;
          is_read?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      market_listings: {
        Row: {
          id: string;
          seller_id: string;
          title: string;
          description: string | null;
          price: number;
          category: string;
          condition: string | null;
          images: Json;
          contact: string;
          is_service: boolean;
          status: string;
          is_leaving_sale: boolean;
          hostel_id: string | null;
          service_type: string | null;
          views_count: number;
          vendor_name: string | null;
          vendor_whatsapp: string | null;
          is_unclaimed: boolean;
          price_varies: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          title: string;
          description?: string | null;
          price: number;
          category: string;
          condition?: string | null;
          images?: Json;
          contact: string;
          is_service?: boolean;
          status?: string;
          is_leaving_sale?: boolean;
          hostel_id?: string | null;
          service_type?: string | null;
          views_count?: number;
          vendor_name?: string | null;
          vendor_whatsapp?: string | null;
          is_unclaimed?: boolean;
          price_varies?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          seller_id?: string;
          title?: string;
          description?: string | null;
          price?: number;
          category?: string;
          condition?: string | null;
          images?: Json;
          contact?: string;
          is_service?: boolean;
          status?: string;
          is_leaving_sale?: boolean;
          hostel_id?: string | null;
          service_type?: string | null;
          views_count?: number;
          vendor_name?: string | null;
          vendor_whatsapp?: string | null;
          is_unclaimed?: boolean;
          price_varies?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_listings_hostel_id_fkey";
            columns: ["hostel_id"];
            isOneToOne: false;
            referencedRelation: "hostels";
            referencedColumns: ["id"];
          },
        ];
      };
      market_listing_claims: {
        Row: {
          id: string;
          listing_id: string;
          claimant_id: string;
          status: string;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          claimant_id: string;
          status?: string;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          claimant_id?: string;
          status?: string;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_listing_claims_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "market_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_listing_claims_claimant_id_fkey";
            columns: ["claimant_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      app_config: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_suspended: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      set_user_role: {
        Args: { p_user_id: string; p_role: string; p_permissions?: string[] | null };
        Returns: undefined;
      };
      set_user_suspended: {
        Args: { p_user_id: string; p_suspended: boolean };
        Returns: undefined;
      };
      get_user_activity_counts: {
        Args: { p_user_ids: string[] };
        Returns: {
          user_id: string;
          review_count: number;
          save_count: number;
          submission_count: number;
          owned_hostel_count: number;
        }[];
      };
      get_active_users_count: {
        Args: { p_since: string };
        Returns: number;
      };
      delete_user_reviews: {
        Args: { p_user_id: string };
        Returns: number;
      };
      recalculate_hostel_rating: {
        Args: { p_hostel_id: string };
        Returns: undefined;
      };
      report_review: {
        Args: { p_review_id: string };
        Returns: undefined;
      };
      submit_pending_edit: {
        Args: { p_hostel_id: string; p_pending_changes: Json };
        Returns: undefined;
      };
      apply_pending_changes: {
        Args: { p_hostel_id: string };
        Returns: undefined;
      };
      approve_submission: {
        Args: { p_submission_id: string };
        Returns: string;
      };
      reject_submission: {
        Args: { p_submission_id: string; p_admin_note?: string | null };
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
          p_price_min?: number | null;
          p_price_max?: number | null;
          p_room_type?: string | null;
        };
        Returns: {
          id: string;
          name: string;
          price_min: number | null;
          price_max: number | null;
          location: string;
          distance_text: string | null;
          images: Json;
          room_types: Json;
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
      increment_listing_views: {
        Args: { p_listing_id: string };
        Returns: undefined;
      };
      get_market_feed: {
        Args: {
          p_search?: string | null;
          p_category?: string | null;
          p_condition?: string | null;
          p_free_only?: boolean;
          p_price_min?: number | null;
          p_price_max?: number | null;
          p_sort?: string;
          p_cursor_created_at?: string | null;
          p_cursor_price?: number | null;
          p_cursor_id?: string | null;
          p_limit?: number;
          p_leaving_sale_only?: boolean;
          p_service_type?: string | null;
        };
        Returns: {
          id: string;
          seller_id: string;
          title: string;
          description: string | null;
          price: number;
          category: string;
          condition: string | null;
          images: Json;
          contact: string;
          is_service: boolean;
          is_leaving_sale: boolean;
          service_type: string | null;
          views_count: number;
          is_unclaimed: boolean;
          price_varies: boolean;
          created_at: string;
        }[];
      };
      get_profile_stats: {
        Args: { p_user_id: string };
        Returns: { review_count: number; listing_count: number; buzz_post_count: number }[];
      };
      get_push_subscriptions_for_user: {
        Args: { p_user_id: string; p_dispatch_secret: string };
        Returns: { endpoint: string; p256dh: string; auth: string }[];
      };
      delete_dead_push_subscriptions: {
        Args: { p_endpoints: string[]; p_dispatch_secret: string };
        Returns: undefined;
      };
      send_admin_broadcast: {
        Args: { p_title: string; p_body: string; p_link?: string | null };
        Returns: number;
      };
      report_seller_review: {
        Args: { p_review_id: string };
        Returns: undefined;
      };
      get_seller_public_profile: {
        Args: { p_seller_id: string };
        Returns: {
          full_name: string | null;
          created_at: string;
          is_leaving_sale: boolean;
          leaving_date: string | null;
          is_verified: boolean;
          verification_label: string | null;
          seller_rating_avg: number;
          seller_rating_count: number;
        }[];
      };
      set_user_verified: {
        Args: { p_user_id: string; p_verified: boolean; p_label?: string | null };
        Returns: undefined;
      };
      get_verified_profiles: {
        Args: { p_user_ids: string[] };
        Returns: { id: string; verification_label: string | null }[];
      };
      toggle_marketplace: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_pending_launch_count: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      resolve_listing_claim: {
        Args: { p_claim_id: string; p_action: string };
        Returns: undefined;
      };
      get_hot_buzz_posts: {
        Args: {
          p_cursor_score?: number | null;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
          p_limit?: number;
        };
        Returns: {
          id: string;
          author_id: string;
          author_name: string | null;
          content: string;
          is_admin_post: boolean;
          is_pinned: boolean;
          reply_count: number;
          like_count: number;
          view_count: number;
          is_anonymous: boolean;
          author_avatar_color: string | null;
          created_at: string;
          hot_score: number;
        }[];
      };
      get_public_profile: {
        Args: { p_user_id: string };
        Returns: {
          username: string | null;
          bio: string | null;
          whatsapp_number: string | null;
          phone_number: string | null;
          avatar_color: string | null;
          is_verified: boolean;
          verification_label: string | null;
          created_at: string;
        }[];
      };
      resolve_buzz_report: {
        Args: { p_report_id: string; p_action: string };
        Returns: undefined;
      };
      increment_buzz_view: {
        Args: { p_post_id: string };
        Returns: undefined;
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      mark_all_notifications_read: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_unread_notifications_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      set_leaving_campus_mode: {
        Args: { p_enabled: boolean; p_leaving_date?: string | null };
        Returns: undefined;
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
// 'manage_admins' is deliberately excluded -- it's never actually stored
// in anyone's admin_permissions array (see set_user_role's own CHECK);
// promoting/demoting and setting permissions is super-admin-only,
// checked via is_super_admin() directly, not the permission array.
export type AdminPermission =
  | "manage_hostels"
  | "manage_users"
  | "moderate_buzz"
  | "moderate_reviews"
  | "moderate_market"
  | "send_broadcasts";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type NotificationType =
  | "buzz_reply"
  | "buzz_like"
  | "buzz_pin"
  | "hostel_update"
  | "admin_report"
  | "welcome"
  | "admin_broadcast";
export type RoommateRequestStatus = "pending" | "accepted" | "declined";
export type MarketCategory =
  | "hostel_essentials"
  | "academics"
  | "electronics"
  | "fashion"
  | "kitchen"
  | "transport"
  | "gaming"
  | "services"
  | "other";
export type MarketCondition = "new" | "like_new" | "good" | "fair";
export type MarketListingStatus = "active" | "sold" | "removed" | "pending_launch";
export type MarketListingClaimStatus = "pending" | "approved" | "rejected";
export type MarketServiceType =
  | "tutoring"
  | "design"
  | "programming"
  | "laundry"
  | "haircut_barber"
  | "photography"
  | "other";
