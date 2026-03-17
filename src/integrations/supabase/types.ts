export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      challenge_entries: {
        Row: {
          id: string
          logged_at: string
          participant_id: string
          user_id: string
          value: number
        }
        Insert: {
          id?: string
          logged_at?: string
          participant_id: string
          user_id: string
          value?: number
        }
        Update: {
          id?: string
          logged_at?: string
          participant_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_entries_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "challenge_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          current_value: number
          id: string
          is_public: boolean
          joined_at: string
          monthly_challenge_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          current_value?: number
          id?: string
          is_public?: boolean
          joined_at?: string
          monthly_challenge_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          current_value?: number
          id?: string
          is_public?: boolean
          joined_at?: string
          monthly_challenge_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_monthly_challenge_id_fkey"
            columns: ["monthly_challenge_id"]
            isOneToOne: false
            referencedRelation: "monthly_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_direct_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
          sender_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          sender_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          sender_role?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_notes: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          note: string
          progress_log_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          note: string
          progress_log_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          note?: string
          progress_log_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_notes_progress_log_id_fkey"
            columns: ["progress_log_id"]
            isOneToOne: false
            referencedRelation: "progress_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_library: {
        Row: {
          client_type: string[]
          created_at: string
          equipment_needed: string
          fix_it_protocol: string[]
          focus_area: string[]
          id: string
          is_fix_it: boolean
          sport: string[]
          the_why: string
          title: string
        }
        Insert: {
          client_type?: string[]
          created_at?: string
          equipment_needed?: string
          fix_it_protocol?: string[]
          focus_area?: string[]
          id?: string
          is_fix_it?: boolean
          sport?: string[]
          the_why?: string
          title: string
        }
        Update: {
          client_type?: string[]
          created_at?: string
          equipment_needed?: string
          fix_it_protocol?: string[]
          focus_area?: string[]
          id?: string
          is_fix_it?: boolean
          sport?: string[]
          the_why?: string
          title?: string
        }
        Relationships: []
      }
      gift_cards: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          original_amount: number
          purchaser_id: string
          recipient_email: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          remaining_balance: number
          stripe_session_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          original_amount: number
          purchaser_id: string
          recipient_email?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          remaining_balance: number
          stripe_session_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          original_amount?: number
          purchaser_id?: string
          recipient_email?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          remaining_balance?: number
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      gifted_products: {
        Row: {
          gift_type: string
          gifted_at: string
          gifted_by: string
          id: string
          notes: string | null
          product_id: string | null
          promotion_id: string | null
          user_id: string
        }
        Insert: {
          gift_type?: string
          gifted_at?: string
          gifted_by: string
          id?: string
          notes?: string | null
          product_id?: string | null
          promotion_id?: string | null
          user_id: string
        }
        Update: {
          gift_type?: string
          gifted_at?: string
          gifted_by?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          promotion_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gifted_products_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      lift_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          progress_log_id: string
          sender_id: string
          sender_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          progress_log_id: string
          sender_id: string
          sender_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          progress_log_id?: string
          sender_id?: string
          sender_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lift_messages_progress_log_id_fkey"
            columns: ["progress_log_id"]
            isOneToOne: false
            referencedRelation: "progress_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      logged_exercises: {
        Row: {
          client_notes: string | null
          coach_reply: string | null
          created_at: string
          exercise_id: string
          flag_for_coach: boolean
          id: string
          log_id: string
          sets_reps_weight: Json
          video_url: string | null
        }
        Insert: {
          client_notes?: string | null
          coach_reply?: string | null
          created_at?: string
          exercise_id: string
          flag_for_coach?: boolean
          id?: string
          log_id: string
          sets_reps_weight?: Json
          video_url?: string | null
        }
        Update: {
          client_notes?: string | null
          coach_reply?: string | null
          created_at?: string
          exercise_id?: string
          flag_for_coach?: boolean
          id?: string
          log_id?: string
          sets_reps_weight?: Json
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logged_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logged_exercises_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_challenges: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_active: boolean
          metric_label: string
          month: number
          title: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          metric_label?: string
          month: number
          title: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          metric_label?: string
          month?: number
          title?: string
          year?: number
        }
        Relationships: []
      }
      monthly_focus: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          exercises: string[]
          id: string
          matt_quote: string
          month: number
          reasoning: string
          status: string
          title: string
          topic: string
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          exercises?: string[]
          id?: string
          matt_quote?: string
          month: number
          reasoning?: string
          status?: string
          title: string
          topic?: string
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          exercises?: string[]
          id?: string
          matt_quote?: string
          month?: number
          reasoning?: string
          status?: string
          title?: string
          topic?: string
          year?: number
        }
        Relationships: []
      }
      newsletter_sends: {
        Row: {
          body: string
          id: string
          recipient_count: number
          sent_at: string
          sent_by: string | null
          subject: string
          template_name: string | null
        }
        Insert: {
          body: string
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          subject: string
          template_name?: string | null
        }
        Update: {
          body?: string
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          subject?: string
          template_name?: string | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          is_active: boolean
          source: string
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean
          source?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean
          source?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          athlete_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_in_person: boolean
          is_pro: boolean
          stripe_customer_id: string | null
          subscription_tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          athlete_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_in_person?: boolean
          is_pro?: boolean
          stripe_customer_id?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          athlete_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_in_person?: boolean
          is_pro?: boolean
          stripe_customer_id?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      program_messages: {
        Row: {
          coach_reply: string | null
          created_at: string
          day_number: number
          exercise_name: string
          id: string
          is_read: boolean
          message: string
          program_id: string
          user_id: string
          video_url: string | null
          week_number: number
        }
        Insert: {
          coach_reply?: string | null
          created_at?: string
          day_number?: number
          exercise_name?: string
          id?: string
          is_read?: boolean
          message: string
          program_id: string
          user_id: string
          video_url?: string | null
          week_number?: number
        }
        Update: {
          coach_reply?: string | null
          created_at?: string
          day_number?: number
          exercise_name?: string
          id?: string
          is_read?: boolean
          message?: string
          program_id?: string
          user_id?: string
          video_url?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_messages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_workouts: {
        Row: {
          coach_instructions: string
          created_at: string
          day_number: number
          exercise_id: string
          id: string
          prescribed_sets_reps: string
          program_id: string
          sort_order: number
          week_number: number
        }
        Insert: {
          coach_instructions?: string
          created_at?: string
          day_number?: number
          exercise_id: string
          id?: string
          prescribed_sets_reps?: string
          program_id: string
          sort_order?: number
          week_number?: number
        }
        Update: {
          coach_instructions?: string
          created_at?: string
          day_number?: number
          exercise_id?: string
          id?: string
          prescribed_sets_reps?: string
          program_id?: string
          sort_order?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_workouts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_workouts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_logs: {
        Row: {
          estimated_1rm: number | null
          exercise_name: string
          id: string
          logged_at: string
          reps: number
          user_id: string
          weight: number
        }
        Insert: {
          estimated_1rm?: number | null
          exercise_name: string
          id?: string
          logged_at?: string
          reps?: number
          user_id: string
          weight: number
        }
        Update: {
          estimated_1rm?: number | null
          exercise_name?: string
          id?: string
          logged_at?: string
          reps?: number
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      promotions: {
        Row: {
          applies_to: string
          code: string
          created_at: string
          current_uses: number
          description: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          specific_product_id: string | null
        }
        Insert: {
          applies_to?: string
          code: string
          created_at?: string
          current_uses?: number
          description?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          specific_product_id?: string | null
        }
        Update: {
          applies_to?: string
          code?: string
          created_at?: string
          current_uses?: number
          description?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          specific_product_id?: string | null
        }
        Relationships: []
      }
      protocol_exercises: {
        Row: {
          created_at: string
          exercise_name: string
          id: string
          notes: string | null
          protocol_id: string
          reps: string | null
          rpe: number | null
          sets: number | null
          sort_order: number
          weight: number | null
        }
        Insert: {
          created_at?: string
          exercise_name: string
          id?: string
          notes?: string | null
          protocol_id: string
          reps?: string | null
          rpe?: number | null
          sets?: number | null
          sort_order?: number
          weight?: number | null
        }
        Update: {
          created_at?: string
          exercise_name?: string
          id?: string
          notes?: string | null
          protocol_id?: string
          reps?: string | null
          rpe?: number | null
          sets?: number | null
          sort_order?: number
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "protocol_exercises_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      protocols: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          is_template: boolean
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_template?: boolean
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_template?: boolean
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      purchased_programs: {
        Row: {
          exercises: Json
          id: string
          is_active: boolean
          notes_from_matt: string | null
          program_title: string
          program_type: string
          purchased_at: string
          sport: string | null
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          exercises?: Json
          id?: string
          is_active?: boolean
          notes_from_matt?: string | null
          program_title: string
          program_type?: string
          purchased_at?: string
          sport?: string | null
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          exercises?: Json
          id?: string
          is_active?: boolean
          notes_from_matt?: string | null
          program_title?: string
          program_type?: string
          purchased_at?: string
          sport?: string | null
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      schedule_slots: {
        Row: {
          booked_by: string | null
          booking_id: string | null
          created_at: string
          id: string
          is_available: boolean
          slot_date: string
          start_time: string
        }
        Insert: {
          booked_by?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          slot_date: string
          start_time: string
        }
        Update: {
          booked_by?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          slot_date?: string
          start_time?: string
        }
        Relationships: []
      }
      session_bookings: {
        Row: {
          amount_cents: number
          cancelled_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          slot_date: string
          start_time: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          amount_cents: number
          cancelled_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          slot_date: string
          start_time: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          amount_cents?: number
          cancelled_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          slot_date?: string
          start_time?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          content_key: string
          content_type: string
          content_value: string
          id: string
          label: string
          section: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_key: string
          content_type?: string
          content_value?: string
          id?: string
          label?: string
          section: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_key?: string
          content_type?: string
          content_value?: string
          id?: string
          label?: string
          section?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          id: string
          is_visible: boolean
          label: string
          section_key: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_visible?: boolean
          label: string
          section_key: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_visible?: boolean
          label?: string
          section_key?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      studio_checkins: {
        Row: {
          checked_in_at: string
          id: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          id?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tier_features: {
        Row: {
          created_at: string
          description: string
          feature_key: string
          feature_label: string
          id: string
          sort_order: number
          tier_basic: boolean
          tier_elite: boolean
          tier_legend: boolean
          tier_pro: boolean
          tier_team: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          feature_key: string
          feature_label?: string
          id?: string
          sort_order?: number
          tier_basic?: boolean
          tier_elite?: boolean
          tier_legend?: boolean
          tier_pro?: boolean
          tier_team?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          feature_key?: string
          feature_label?: string
          id?: string
          sort_order?: number
          tier_basic?: boolean
          tier_elite?: boolean
          tier_legend?: boolean
          tier_pro?: boolean
          tier_team?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      training_programs: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          level: string
          price: number
          sport: string | null
          status: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          level?: string
          price?: number
          sport?: string | null
          status?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          level?: string
          price?: number
          sport?: string | null
          status?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_active_programs: {
        Row: {
          created_at: string
          id: string
          program_id: string
          start_date: string
          status: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          start_date?: string
          status?: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          start_date?: string
          status?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          session_notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          session_notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          session_notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      workout_logs_legacy: {
        Row: {
          created_at: string
          date: string
          exercise_name: string
          id: string
          notes: string | null
          reps: number
          sets: number
          user_id: string
          weight_lifted: number
        }
        Insert: {
          created_at?: string
          date?: string
          exercise_name: string
          id?: string
          notes?: string | null
          reps?: number
          sets?: number
          user_id: string
          weight_lifted?: number
        }
        Update: {
          created_at?: string
          date?: string
          exercise_name?: string
          id?: string
          notes?: string | null
          reps?: number
          sets?: number
          user_id?: string
          weight_lifted?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
