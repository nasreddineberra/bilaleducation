// FICHIER GENERE par `npm run types-db` (scripts/generer-types-db.mjs) : ne pas editer.
// Structure du schema public du projet Supabase, le 2026-10-28.

import type { ColonnesJson } from './json'

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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          absence_date: string
          absence_type: "absence" | "retard"
          class_id: string
          comment: string | null
          created_at: string | null
          etablissement_id: string
          id: string
          is_justified: boolean
          justification_comment: string | null
          justification_date: string | null
          justification_document_url: string | null
          period_id: string
          recorded_by: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          absence_date: string
          absence_type: "absence" | "retard"
          class_id: string
          comment?: string | null
          created_at?: string | null
          etablissement_id: string
          id?: string
          is_justified?: boolean
          justification_comment?: string | null
          justification_date?: string | null
          justification_document_url?: string | null
          period_id: string
          recorded_by?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          absence_date?: string
          absence_type?: "absence" | "retard"
          class_id?: string
          comment?: string | null
          created_at?: string | null
          etablissement_id?: string
          id?: string
          is_justified?: boolean
          justification_comment?: string | null
          justification_date?: string | null
          justification_document_url?: string | null
          period_id?: string
          recorded_by?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absences_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      absences_enseignants: {
        Row: {
          created_at: string
          created_by: string | null
          debut: string
          etablissement_id: string
          fin: string
          id: string
          motif: "conge" | "maladie" | "personnel" | "formation" | "autre"
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          debut: string
          etablissement_id?: string
          fin: string
          id?: string
          motif: "conge" | "maladie" | "personnel" | "formation" | "autre"
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          debut?: string
          etablissement_id?: string
          fin?: string
          id?: string
          motif?: "conge" | "maladie" | "personnel" | "formation" | "autre"
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_enseignants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_enseignants_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_enseignants_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      absences_enseignants_seances: {
        Row: {
          absence_id: string
          decide_le: string
          decide_par: string | null
          decision: "remplacee" | "annulee"
          etablissement_id: string
          familles_prevenues_le: string | null
          id: string
          remplacant_profile_id: string | null
          schedule_slot_id: string
          seance_date: string
        }
        Insert: {
          absence_id: string
          decide_le?: string
          decide_par?: string | null
          decision: "remplacee" | "annulee"
          etablissement_id?: string
          familles_prevenues_le?: string | null
          id?: string
          remplacant_profile_id?: string | null
          schedule_slot_id: string
          seance_date: string
        }
        Update: {
          absence_id?: string
          decide_le?: string
          decide_par?: string | null
          decision?: "remplacee" | "annulee"
          etablissement_id?: string
          familles_prevenues_le?: string | null
          id?: string
          remplacant_profile_id?: string | null
          schedule_slot_id?: string
          seance_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_enseignants_seances_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: false
            referencedRelation: "absences_enseignants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_enseignants_seances_decide_par_fkey"
            columns: ["decide_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_enseignants_seances_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_enseignants_seances_remplacant_profile_id_fkey"
            columns: ["remplacant_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_enseignants_seances_schedule_slot_id_fkey"
            columns: ["schedule_slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      actions_editeur: {
        Row: {
          created_at: string
          description: string
          est_purge: boolean
          etablissement_id: string
          id: string
          super_admin_email: string | null
          super_admin_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          est_purge?: boolean
          etablissement_id: string
          id?: string
          super_admin_email?: string | null
          super_admin_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          est_purge?: boolean
          etablissement_id?: string
          id?: string
          super_admin_email?: string | null
          super_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actions_editeur_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_editeur_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adult_absences: {
        Row: {
          absence_date: string
          absence_type: "absence" | "retard"
          class_id: string
          comment: string | null
          created_at: string | null
          etablissement_id: string
          id: string
          is_justified: boolean
          justification_comment: string | null
          justification_date: string | null
          justification_document_url: string | null
          parent_id: string
          period_id: string
          recorded_by: string | null
          tutor_number: 1 | 2
          updated_at: string | null
        }
        Insert: {
          absence_date: string
          absence_type: "absence" | "retard"
          class_id: string
          comment?: string | null
          created_at?: string | null
          etablissement_id: string
          id?: string
          is_justified?: boolean
          justification_comment?: string | null
          justification_date?: string | null
          justification_document_url?: string | null
          parent_id: string
          period_id: string
          recorded_by?: string | null
          tutor_number: 1 | 2
          updated_at?: string | null
        }
        Update: {
          absence_date?: string
          absence_type?: "absence" | "retard"
          class_id?: string
          comment?: string | null
          created_at?: string | null
          etablissement_id?: string
          id?: string
          is_justified?: boolean
          justification_comment?: string | null
          justification_date?: string | null
          justification_document_url?: string | null
          parent_id?: string
          period_id?: string
          recorded_by?: string | null
          tutor_number?: 1 | 2
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adult_absences_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_absences_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_absences_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_absences_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_absences_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adult_bulletin_appreciations: {
        Row: {
          appreciation: string
          class_id: string
          etablissement_id: string
          id: string
          parent_id: string
          period_id: string
          tutor_number: 1 | 2
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          appreciation?: string
          class_id: string
          etablissement_id: string
          id?: string
          parent_id: string
          period_id: string
          tutor_number: 1 | 2
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          appreciation?: string
          class_id?: string
          etablissement_id?: string
          id?: string
          parent_id?: string
          period_id?: string
          tutor_number?: 1 | 2
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adult_bulletin_appreciations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_bulletin_appreciations_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_bulletin_appreciations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_bulletin_appreciations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_bulletin_appreciations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adult_bulletin_archives: {
        Row: {
          absences_count: number
          absences_unjustified: number
          archived_at: string
          archived_by: string | null
          class_id: string
          etablissement_id: string
          file_path: string
          id: string
          moyenne_generale: number | null
          parent_id: string
          period_id: string
          retards_count: number
          tutor_number: 1 | 2
        }
        Insert: {
          absences_count?: number
          absences_unjustified?: number
          archived_at?: string
          archived_by?: string | null
          class_id: string
          etablissement_id: string
          file_path: string
          id?: string
          moyenne_generale?: number | null
          parent_id: string
          period_id: string
          retards_count?: number
          tutor_number: 1 | 2
        }
        Update: {
          absences_count?: number
          absences_unjustified?: number
          archived_at?: string
          archived_by?: string | null
          class_id?: string
          etablissement_id?: string
          file_path?: string
          id?: string
          moyenne_generale?: number | null
          parent_id?: string
          period_id?: string
          retards_count?: number
          tutor_number?: 1 | 2
        }
        Relationships: [
          {
            foreignKeyName: "adult_bulletin_archives_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_bulletin_archives_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_bulletin_archives_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_bulletin_archives_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_bulletin_archives_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      adult_grades: {
        Row: {
          comment: string | null
          created_at: string
          etablissement_id: string
          evaluation_id: string
          graded_at: string | null
          graded_by: string | null
          id: string
          is_absent: boolean
          parent_id: string
          score: number | null
          tutor_number: 1 | 2
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          etablissement_id: string
          evaluation_id: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_absent?: boolean
          parent_id: string
          score?: number | null
          tutor_number: 1 | 2
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          etablissement_id?: string
          evaluation_id?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_absent?: boolean
          parent_id?: string
          score?: number | null
          tutor_number?: 1 | 2
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adult_grades_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_grades_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_grades_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_grades_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      adult_homework_status: {
        Row: {
          created_at: string
          done_at: string | null
          homework_id: string
          id: string
          is_done: boolean
          is_seen: boolean
          parent_id: string
          seen_at: string | null
          tutor_number: 1 | 2
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          homework_id: string
          id?: string
          is_done?: boolean
          is_seen?: boolean
          parent_id: string
          seen_at?: string | null
          tutor_number: 1 | 2
        }
        Update: {
          created_at?: string
          done_at?: string | null
          homework_id?: string
          id?: string
          is_done?: boolean
          is_seen?: boolean
          parent_id?: string
          seen_at?: string | null
          tutor_number?: 1 | 2
        }
        Relationships: [
          {
            foreignKeyName: "adult_homework_status_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_homework_status_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_attachments: {
        Row: {
          announcement_id: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
        }
        Update: {
          announcement_id?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_recipients: {
        Row: {
          announcement_id: string
          created_at: string | null
          email: string | null
          email_status: "pending" | "sent" | "delivered" | "failed" | "skipped" | null
          id: string
          is_read: boolean | null
          parent_id: string
          read_at: string | null
          sent_at: string | null
        }
        Insert: {
          announcement_id: string
          created_at?: string | null
          email?: string | null
          email_status?: "pending" | "sent" | "delivered" | "failed" | "skipped" | null
          id?: string
          is_read?: boolean | null
          parent_id: string
          read_at?: string | null
          sent_at?: string | null
        }
        Update: {
          announcement_id?: string
          created_at?: string | null
          email?: string | null
          email_status?: "pending" | "sent" | "delivered" | "failed" | "skipped" | null
          id?: string
          is_read?: boolean | null
          parent_id?: string
          read_at?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_staff_recipients: {
        Row: {
          announcement_id: string
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_status: "pending" | "sent" | "delivered" | "failed" | "skipped" | null
          id: string
          is_read: boolean | null
          profile_id: string
          read_at: string | null
          sent_at: string | null
        }
        Insert: {
          announcement_id: string
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_status?: "pending" | "sent" | "delivered" | "failed" | "skipped" | null
          id?: string
          is_read?: boolean | null
          profile_id: string
          read_at?: string | null
          sent_at?: string | null
        }
        Update: {
          announcement_id?: string
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_status?: "pending" | "sent" | "delivered" | "failed" | "skipped" | null
          id?: string
          is_read?: boolean | null
          profile_id?: string
          read_at?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_staff_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_staff_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          announcement_type: "all_active" | "all_registered" | "class" | "selected" | "staff" | null
          body_html: string | null
          channel: "email" | "notification" | "both" | null
          content: string
          created_at: string | null
          etablissement_id: string
          expires_at: string | null
          id: string
          is_published: boolean | null
          priority: "low" | "normal" | "high" | "urgent" | null
          published_at: string | null
          published_by: string | null
          recipient_count: number | null
          sender_email: string | null
          sent_at: string | null
          target_class_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          announcement_type?: "all_active" | "all_registered" | "class" | "selected" | "staff" | null
          body_html?: string | null
          channel?: "email" | "notification" | "both" | null
          content: string
          created_at?: string | null
          etablissement_id?: string
          expires_at?: string | null
          id?: string
          is_published?: boolean | null
          priority?: "low" | "normal" | "high" | "urgent" | null
          published_at?: string | null
          published_by?: string | null
          recipient_count?: number | null
          sender_email?: string | null
          sent_at?: string | null
          target_class_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          announcement_type?: "all_active" | "all_registered" | "class" | "selected" | "staff" | null
          body_html?: string | null
          channel?: "email" | "notification" | "both" | null
          content?: string
          created_at?: string | null
          etablissement_id?: string
          expires_at?: string | null
          id?: string
          is_published?: boolean | null
          priority?: "low" | "normal" | "high" | "urgent" | null
          published_at?: string | null
          published_by?: string | null
          recipient_count?: number | null
          sender_email?: string | null
          sent_at?: string | null
          target_class_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_target_class_id_fkey"
            columns: ["target_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: "INSERT" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT"
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          etablissement_id: string
          id: string
          new_data: ColonnesJson['audit_logs.new_data'] | null
          old_data: ColonnesJson['audit_logs.old_data'] | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: "INSERT" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT"
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          etablissement_id: string
          id?: string
          new_data?: ColonnesJson['audit_logs.new_data'] | null
          old_data?: ColonnesJson['audit_logs.old_data'] | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: "INSERT" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT"
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          etablissement_id?: string
          id?: string
          new_data?: ColonnesJson['audit_logs.new_data'] | null
          old_data?: ColonnesJson['audit_logs.old_data'] | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_appreciations: {
        Row: {
          appreciation: string
          class_id: string
          etablissement_id: string
          id: string
          period_id: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          appreciation?: string
          class_id: string
          etablissement_id: string
          id?: string
          period_id: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          appreciation?: string
          class_id?: string
          etablissement_id?: string
          id?: string
          period_id?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_appreciations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_appreciations_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_appreciations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_appreciations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_appreciations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_archives: {
        Row: {
          absences_count: number
          absences_unjustified: number
          archived_at: string
          archived_by: string | null
          class_id: string
          etablissement_id: string
          file_path: string
          id: string
          moyenne_generale: number | null
          period_id: string
          retards_count: number
          student_id: string
        }
        Insert: {
          absences_count?: number
          absences_unjustified?: number
          archived_at?: string
          archived_by?: string | null
          class_id: string
          etablissement_id: string
          file_path: string
          id?: string
          moyenne_generale?: number | null
          period_id: string
          retards_count?: number
          student_id: string
        }
        Update: {
          absences_count?: number
          absences_unjustified?: number
          archived_at?: string
          archived_by?: string | null
          class_id?: string
          etablissement_id?: string
          file_path?: string
          id?: string
          moyenne_generale?: number | null
          period_id?: string
          retards_count?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_archives_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_archives_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_archives_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_archives_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_archives_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_journal: {
        Row: {
          class_id: string
          content_html: string
          created_at: string
          etablissement_id: string
          id: string
          session_date: string
          subject: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          content_html?: string
          created_at?: string
          etablissement_id: string
          id?: string
          session_date: string
          subject?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          content_html?: string
          created_at?: string
          etablissement_id?: string
          id?: string
          session_date?: string
          subject?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_journal_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_journal_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_journal_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          class_id: string
          created_at: string | null
          effective_from: string | null
          effective_until: string | null
          id: string
          is_main_teacher: boolean | null
          subject: string | null
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_main_teacher?: boolean | null
          subject?: string | null
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_main_teacher?: boolean | null
          subject?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_year_history: {
        Row: {
          class_id: string | null
          class_name: string
          cotisation_label: string | null
          created_at: string
          creneaux: Json
          effectif: number
          etablissement_id: string
          id: string
          is_adult: boolean
          level: string | null
          max_students: number | null
          participants: Json
          remplacements: Json
          school_year_id: string | null
          titulaires: Json
          year_label: string
        }
        Insert: {
          class_id?: string | null
          class_name: string
          cotisation_label?: string | null
          created_at?: string
          creneaux?: Json
          effectif?: number
          etablissement_id: string
          id?: string
          is_adult?: boolean
          level?: string | null
          max_students?: number | null
          participants?: Json
          remplacements?: Json
          school_year_id?: string | null
          titulaires?: Json
          year_label: string
        }
        Update: {
          class_id?: string | null
          class_name?: string
          cotisation_label?: string | null
          created_at?: string
          creneaux?: Json
          effectif?: number
          etablissement_id?: string
          id?: string
          is_adult?: boolean
          level?: string | null
          max_students?: number | null
          participants?: Json
          remplacements?: Json
          school_year_id?: string | null
          titulaires?: Json
          year_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_year_history_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_year_history_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_year_history_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string
          cotisation_type_id: string | null
          created_at: string | null
          day_of_week: string | null
          description: string | null
          end_time: string | null
          etablissement_id: string
          id: string
          is_active: boolean | null
          level: string
          max_students: number | null
          name: string
          room_id: string | null
          room_number: string | null
          schedule_notes: string | null
          start_time: string | null
          teaching_mode: "single" | "multi"
          updated_at: string | null
        }
        Insert: {
          academic_year: string
          cotisation_type_id?: string | null
          created_at?: string | null
          day_of_week?: string | null
          description?: string | null
          end_time?: string | null
          etablissement_id?: string
          id?: string
          is_active?: boolean | null
          level: string
          max_students?: number | null
          name: string
          room_id?: string | null
          room_number?: string | null
          schedule_notes?: string | null
          start_time?: string | null
          teaching_mode?: "single" | "multi"
          updated_at?: string | null
        }
        Update: {
          academic_year?: string
          cotisation_type_id?: string | null
          created_at?: string | null
          day_of_week?: string | null
          description?: string | null
          end_time?: string | null
          etablissement_id?: string
          id?: string
          is_active?: boolean | null
          level?: string
          max_students?: number | null
          name?: string
          room_id?: string | null
          room_number?: string | null
          schedule_notes?: string | null
          start_time?: string | null
          teaching_mode?: "single" | "multi"
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_cotisation_type_id_fkey"
            columns: ["cotisation_type_id"]
            isOneToOne: false
            referencedRelation: "cotisation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      cotisation_types: {
        Row: {
          amount: number
          created_at: string
          etablissement_id: string
          id: string
          is_adult: boolean
          label: string
          max_installments: number
          order_index: number
          registration_fee: number
          school_year_id: string
          sibling_discount: number
          sibling_discount_same_type: boolean
        }
        Insert: {
          amount?: number
          created_at?: string
          etablissement_id?: string
          id?: string
          is_adult?: boolean
          label: string
          max_installments?: number
          order_index?: number
          registration_fee?: number
          school_year_id: string
          sibling_discount?: number
          sibling_discount_same_type?: boolean
        }
        Update: {
          amount?: number
          created_at?: string
          etablissement_id?: string
          id?: string
          is_adult?: boolean
          label?: string
          max_installments?: number
          order_index?: number
          registration_fee?: number
          school_year_id?: string
          sibling_discount?: number
          sibling_discount_same_type?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cotisation_types_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotisation_types_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      cours: {
        Row: {
          code: string | null
          created_at: string | null
          duree_minutes: number | null
          id: string
          module_id: string | null
          nom_ar: string | null
          nom_fr: string
          order_index: number | null
          unite_enseignement_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          duree_minutes?: number | null
          id?: string
          module_id?: string | null
          nom_ar?: string | null
          nom_fr: string
          order_index?: number | null
          unite_enseignement_id: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          duree_minutes?: number | null
          id?: string
          module_id?: string | null
          nom_ar?: string | null
          nom_fr?: string
          order_index?: number | null
          unite_enseignement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cours_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "cours_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cours_unite_enseignement_id_fkey"
            columns: ["unite_enseignement_id"]
            isOneToOne: false
            referencedRelation: "unites_enseignement"
            referencedColumns: ["id"]
          },
        ]
      }
      cours_modules: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          nom_ar: string | null
          nom_fr: string
          order_index: number | null
          unite_enseignement_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          nom_ar?: string | null
          nom_fr: string
          order_index?: number | null
          unite_enseignement_id: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          nom_ar?: string | null
          nom_fr?: string
          order_index?: number | null
          unite_enseignement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cours_modules_unite_enseignement_id_fkey"
            columns: ["unite_enseignement_id"]
            isOneToOne: false
            referencedRelation: "unites_enseignement"
            referencedColumns: ["id"]
          },
        ]
      }
      document_type_configs: {
        Row: {
          category: "identite" | "medical" | "assurance" | "autres"
          created_at: string
          doc_key: string
          etablissement_id: string
          id: string
          is_required: boolean
          label: string
          order_index: number
        }
        Insert: {
          category: "identite" | "medical" | "assurance" | "autres"
          created_at?: string
          doc_key: string
          etablissement_id: string
          id?: string
          is_required?: boolean
          label: string
          order_index?: number
        }
        Update: {
          category?: "identite" | "medical" | "assurance" | "autres"
          created_at?: string
          doc_key?: string
          etablissement_id?: string
          id?: string
          is_required?: boolean
          label?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_type_configs_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string | null
          date_depart: string | null
          enrollment_date: string | null
          id: string
          notes: string | null
          status: "active" | "withdrawn" | "completed" | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          date_depart?: string | null
          enrollment_date?: string | null
          id?: string
          notes?: string | null
          status?: "active" | "withdrawn" | "completed" | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          date_depart?: string | null
          enrollment_date?: string | null
          id?: string
          notes?: string | null
          status?: "active" | "withdrawn" | "completed" | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      etablissement_departs: {
        Row: {
          comptes: number
          efface_le: string
          efface_par: string | null
          efface_par_email: string | null
          etablissement_id: string
          fichiers: number
          fichiers_effaces: number | null
          id: string
          lignes: Json
          rouvert_le: string | null
          rouvert_par_email: string | null
        }
        Insert: {
          comptes?: number
          efface_le?: string
          efface_par?: string | null
          efface_par_email?: string | null
          etablissement_id: string
          fichiers?: number
          fichiers_effaces?: number | null
          id?: string
          lignes: Json
          rouvert_le?: string | null
          rouvert_par_email?: string | null
        }
        Update: {
          comptes?: number
          efface_le?: string
          efface_par?: string | null
          efface_par_email?: string | null
          etablissement_id?: string
          fichiers?: number
          fichiers_effaces?: number | null
          id?: string
          lignes?: Json
          rouvert_le?: string | null
          rouvert_par_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "etablissement_departs_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      etablissement_facturation: {
        Row: {
          adresse: string | null
          email: string | null
          etablissement_id: string
          forfait: number | null
          identifiant: string | null
          prix_inscrit: number | null
          responsable: string | null
          structure: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          email?: string | null
          etablissement_id: string
          forfait?: number | null
          identifiant?: string | null
          prix_inscrit?: number | null
          responsable?: string | null
          structure?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          email?: string | null
          etablissement_id?: string
          forfait?: number | null
          identifiant?: string | null
          prix_inscrit?: number | null
          responsable?: string | null
          structure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etablissement_facturation_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: true
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      etablissement_notes: {
        Row: {
          created_at: string
          etablissement_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          etablissement_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          etablissement_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etablissement_notes_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: true
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      etablissement_smtp: {
        Row: {
          created_at: string
          etablissement_id: string
          from_email: string
          from_name: string | null
          host: string
          password: string
          port: number
          secure: boolean
          updated_at: string
          username: string
          verifie_le: string | null
        }
        Insert: {
          created_at?: string
          etablissement_id: string
          from_email: string
          from_name?: string | null
          host: string
          password: string
          port?: number
          secure?: boolean
          updated_at?: string
          username: string
          verifie_le?: string | null
        }
        Update: {
          created_at?: string
          etablissement_id?: string
          from_email?: string
          from_name?: string | null
          host?: string
          password?: string
          port?: number
          secure?: boolean
          updated_at?: string
          username?: string
          verifie_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "etablissement_smtp_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: true
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      etablissements: {
        Row: {
          adresse: string | null
          contact: string | null
          created_at: string | null
          donnees_effacees_le: string | null
          est_demo: boolean
          id: string
          is_active: boolean
          logo_url: string | null
          max_students: number | null
          nom: string
          regle_ajustement: "sans_ajustement" | "due" | "prorata" | "cas_par_cas"
          regle_ajustement_le: string | null
          regle_ajustement_par: string | null
          slug: string
          subscription_expires_at: string | null
          telephone: string | null
          updated_at: string | null
          week_start_day: 0 | 1 | 6 | null
          working_days: 5 | 7
        }
        Insert: {
          adresse?: string | null
          contact?: string | null
          created_at?: string | null
          donnees_effacees_le?: string | null
          est_demo?: boolean
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_students?: number | null
          nom: string
          regle_ajustement?: "sans_ajustement" | "due" | "prorata" | "cas_par_cas"
          regle_ajustement_le?: string | null
          regle_ajustement_par?: string | null
          slug: string
          subscription_expires_at?: string | null
          telephone?: string | null
          updated_at?: string | null
          week_start_day?: 0 | 1 | 6 | null
          working_days?: 5 | 7
        }
        Update: {
          adresse?: string | null
          contact?: string | null
          created_at?: string | null
          donnees_effacees_le?: string | null
          est_demo?: boolean
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_students?: number | null
          nom?: string
          regle_ajustement?: "sans_ajustement" | "due" | "prorata" | "cas_par_cas"
          regle_ajustement_le?: string | null
          regle_ajustement_par?: string | null
          slug?: string
          subscription_expires_at?: string | null
          telephone?: string | null
          updated_at?: string | null
          week_start_day?: 0 | 1 | 6 | null
          working_days?: 5 | 7
        }
        Relationships: [
          {
            foreignKeyName: "etablissements_regle_ajustement_par_fkey"
            columns: ["regle_ajustement_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_type_configs: {
        Row: {
          created_at: string
          diagnostic_options: ColonnesJson['eval_type_configs.diagnostic_options'] | null
          eval_type: "diagnostic" | "scored" | "stars"
          id: string
          is_active: boolean
          max_score: number | null
          school_year_id: string
        }
        Insert: {
          created_at?: string
          diagnostic_options?: ColonnesJson['eval_type_configs.diagnostic_options'] | null
          eval_type: "diagnostic" | "scored" | "stars"
          id?: string
          is_active?: boolean
          max_score?: number | null
          school_year_id: string
        }
        Update: {
          created_at?: string
          diagnostic_options?: ColonnesJson['eval_type_configs.diagnostic_options'] | null
          eval_type?: "diagnostic" | "scored" | "stars"
          id?: string
          is_active?: boolean
          max_score?: number | null
          school_year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_type_configs_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_order_config: {
        Row: {
          class_id: string
          module_order: Json | null
          period_id: string
          ue_order: string[] | null
        }
        Insert: {
          class_id: string
          module_order?: Json | null
          period_id: string
          ue_order?: string[] | null
        }
        Update: {
          class_id?: string
          module_order?: Json | null
          period_id?: string
          ue_order?: string[] | null
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          class_id: string
          coefficient: number | null
          cours_id: string | null
          created_at: string | null
          description: string | null
          display_module_id: string | null
          display_ue_id: string | null
          etablissement_id: string
          eval_kind: "diagnostic" | "scored" | "stars" | null
          evaluation_date: string | null
          evaluation_type: "test" | "exam" | "oral" | "homework" | "participation" | null
          id: string
          max_score: number | null
          period_id: string | null
          sort_order: number | null
          teacher_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          coefficient?: number | null
          cours_id?: string | null
          created_at?: string | null
          description?: string | null
          display_module_id?: string | null
          display_ue_id?: string | null
          etablissement_id?: string
          eval_kind?: "diagnostic" | "scored" | "stars" | null
          evaluation_date?: string | null
          evaluation_type?: "test" | "exam" | "oral" | "homework" | "participation" | null
          id?: string
          max_score?: number | null
          period_id?: string | null
          sort_order?: number | null
          teacher_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          coefficient?: number | null
          cours_id?: string | null
          created_at?: string | null
          description?: string | null
          display_module_id?: string | null
          display_ue_id?: string | null
          etablissement_id?: string
          eval_kind?: "diagnostic" | "scored" | "stars" | null
          evaluation_date?: string | null
          evaluation_type?: "test" | "exam" | "oral" | "homework" | "participation" | null
          id?: string
          max_score?: number | null
          period_id?: string | null
          sort_order?: number | null
          teacher_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_cours_id_fkey"
            columns: ["cours_id"]
            isOneToOne: false
            referencedRelation: "cours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_display_module_id_fkey"
            columns: ["display_module_id"]
            isOneToOne: false
            referencedRelation: "cours_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_display_ue_id_fkey"
            columns: ["display_ue_id"]
            isOneToOne: false
            referencedRelation: "unites_enseignement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          created_by: string | null
          document_path: string | null
          etablissement_id: string
          expense_date: string
          id: string
          label: string
          notes: string | null
          school_year_id: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          document_path?: string | null
          etablissement_id?: string
          expense_date?: string
          id?: string
          label: string
          notes?: string | null
          school_year_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          document_path?: string | null
          etablissement_id?: string
          expense_date?: string
          id?: string
          label?: string
          notes?: string | null
          school_year_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      family_fees: {
        Row: {
          adjustments_total: number
          created_at: string
          etablissement_id: string
          id: string
          num_installments: number
          parent_id: string
          school_year_id: string
          status: "pending" | "partial" | "paid" | "overpaid"
          subtotal: number
          total_due: number
          updated_at: string
        }
        Insert: {
          adjustments_total?: number
          created_at?: string
          etablissement_id?: string
          id?: string
          num_installments?: number
          parent_id: string
          school_year_id: string
          status?: "pending" | "partial" | "paid" | "overpaid"
          subtotal?: number
          total_due?: number
          updated_at?: string
        }
        Update: {
          adjustments_total?: number
          created_at?: string
          etablissement_id?: string
          id?: string
          num_installments?: number
          parent_id?: string
          school_year_id?: string
          status?: "pending" | "partial" | "paid" | "overpaid"
          subtotal?: number
          total_due?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_fees_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_fees_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_fees_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      family_year_finance: {
        Row: {
          adjustments_json: Json
          cotisations_json: Json
          created_at: string
          etablissement_id: string
          id: string
          installments_json: Json
          parent_id: string | null
          remaining: number
          school_year_id: string | null
          status: string | null
          total_due: number
          total_paid: number
          tutor1_first_name: string | null
          tutor1_last_name: string | null
          tutor2_first_name: string | null
          tutor2_last_name: string | null
          year_label: string
        }
        Insert: {
          adjustments_json?: Json
          cotisations_json?: Json
          created_at?: string
          etablissement_id: string
          id?: string
          installments_json?: Json
          parent_id?: string | null
          remaining?: number
          school_year_id?: string | null
          status?: string | null
          total_due?: number
          total_paid?: number
          tutor1_first_name?: string | null
          tutor1_last_name?: string | null
          tutor2_first_name?: string | null
          tutor2_last_name?: string | null
          year_label: string
        }
        Update: {
          adjustments_json?: Json
          cotisations_json?: Json
          created_at?: string
          etablissement_id?: string
          id?: string
          installments_json?: Json
          parent_id?: string | null
          remaining?: number
          school_year_id?: string | null
          status?: string | null
          total_due?: number
          total_paid?: number
          tutor1_first_name?: string | null
          tutor1_last_name?: string | null
          tutor2_first_name?: string | null
          tutor2_last_name?: string | null
          year_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_year_finance_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_year_finance_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_year_finance_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_type: "reduction" | "avoir" | "remboursement"
          amount: number
          created_at: string
          etablissement_id: string
          family_fee_id: string
          id: string
          label: string
          recorded_by: string | null
        }
        Insert: {
          adjustment_date?: string
          adjustment_type: "reduction" | "avoir" | "remboursement"
          amount: number
          created_at?: string
          etablissement_id?: string
          family_fee_id: string
          id?: string
          label: string
          recorded_by?: string | null
        }
        Update: {
          adjustment_date?: string
          adjustment_type?: "reduction" | "avoir" | "remboursement"
          amount?: number
          created_at?: string
          etablissement_id?: string
          family_fee_id?: string
          id?: string
          label?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_adjustments_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_adjustments_family_fee_id_fkey"
            columns: ["family_fee_id"]
            isOneToOne: false
            referencedRelation: "family_fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_adjustments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_installments: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          due_date: string
          etablissement_id: string
          family_fee_id: string
          id: string
          installment_number: number
          notes: string | null
          paid_date: string | null
          payment_method: "cash" | "check" | "card" | "transfer" | "online" | null
          payment_reference: ColonnesJson['fee_installments.payment_reference'] | null
          receipt_number: string | null
          recorded_by: string | null
          status: "pending" | "partial" | "paid" | "overpaid"
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          due_date: string
          etablissement_id?: string
          family_fee_id: string
          id?: string
          installment_number: number
          notes?: string | null
          paid_date?: string | null
          payment_method?: "cash" | "check" | "card" | "transfer" | "online" | null
          payment_reference?: ColonnesJson['fee_installments.payment_reference'] | null
          receipt_number?: string | null
          recorded_by?: string | null
          status?: "pending" | "partial" | "paid" | "overpaid"
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string
          etablissement_id?: string
          family_fee_id?: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_date?: string | null
          payment_method?: "cash" | "check" | "card" | "transfer" | "online" | null
          payment_reference?: ColonnesJson['fee_installments.payment_reference'] | null
          receipt_number?: string | null
          recorded_by?: string | null
          status?: "pending" | "partial" | "paid" | "overpaid"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_installments_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_installments_family_fee_id_fkey"
            columns: ["family_fee_id"]
            isOneToOne: false
            referencedRelation: "family_fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_installments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financement_communications: {
        Row: {
          body_html: string | null
          created_at: string
          etablissement_id: string
          id: string
          parent_id: string
          recipients: string | null
          school_year_id: string | null
          sent_at: string
          sent_by: string | null
          status: "sent" | "failed" | "skipped"
          subject: string
          type: "relance" | "attestation"
        }
        Insert: {
          body_html?: string | null
          created_at?: string
          etablissement_id: string
          id?: string
          parent_id: string
          recipients?: string | null
          school_year_id?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: "sent" | "failed" | "skipped"
          subject: string
          type: "relance" | "attestation"
        }
        Update: {
          body_html?: string | null
          created_at?: string
          etablissement_id?: string
          id?: string
          parent_id?: string
          recipients?: string | null
          school_year_id?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: "sent" | "failed" | "skipped"
          subject?: string
          type?: "relance" | "attestation"
        }
        Relationships: [
          {
            foreignKeyName: "financement_communications_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financement_communications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financement_communications_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financement_communications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          comment: string | null
          created_at: string | null
          evaluation_id: string
          graded_at: string | null
          graded_by: string | null
          id: string
          is_absent: boolean | null
          score: number | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          evaluation_id: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_absent?: boolean | null
          score?: number | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          evaluation_id?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_absent?: boolean | null
          score?: number | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          class_id: string
          created_at: string
          description_html: string
          due_date: string
          etablissement_id: string
          homework_type: "exercice" | "lecon" | "expose" | "autre"
          id: string
          journal_entry_id: string | null
          subject: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description_html?: string
          due_date: string
          etablissement_id: string
          homework_type: "exercice" | "lecon" | "expose" | "autre"
          id?: string
          journal_entry_id?: string | null
          subject: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description_html?: string
          due_date?: string
          etablissement_id?: string
          homework_type?: "exercice" | "lecon" | "expose" | "autre"
          id?: string
          journal_entry_id?: string | null
          subject?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "class_journal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_status: {
        Row: {
          created_at: string
          done_at: string | null
          homework_id: string
          id: string
          is_done: boolean
          is_seen: boolean
          parent_id: string
          seen_at: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          homework_id: string
          id?: string
          is_done?: boolean
          is_seen?: boolean
          parent_id: string
          seen_at?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          homework_id?: string
          id?: string
          is_done?: boolean
          is_seen?: boolean
          parent_id?: string
          seen_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_status_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_status_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_status_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category: "informatique" | "audiovisuel" | "mobilier" | "sport" | "fournitures" | "autre"
          condition: "neuf" | "bon" | "use" | "hors_service"
          created_at: string
          etablissement_id: string
          id: string
          name: string
          notes: string | null
          purchase_date: string | null
          quantity: number
          room_id: string | null
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          category?: "informatique" | "audiovisuel" | "mobilier" | "sport" | "fournitures" | "autre"
          condition?: "neuf" | "bon" | "use" | "hors_service"
          created_at?: string
          etablissement_id: string
          id?: string
          name: string
          notes?: string | null
          purchase_date?: string | null
          quantity?: number
          room_id?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          category?: "informatique" | "audiovisuel" | "mobilier" | "sport" | "fournitures" | "autre"
          condition?: "neuf" | "bon" | "use" | "hors_service"
          created_at?: string
          etablissement_id?: string
          id?: string
          name?: string
          notes?: string | null
          purchase_date?: string | null
          quantity?: number
          room_id?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations_appliquees: {
        Row: {
          applique_par: string | null
          appliquee_le: string
          empreinte: string
          nom: string
          note: string | null
          rejeu: "sans-effet" | "leve" | "destructeur" | null
          source: "atteste" | "presume"
        }
        Insert: {
          applique_par?: string | null
          appliquee_le?: string
          empreinte: string
          nom: string
          note?: string | null
          rejeu?: "sans-effet" | "leve" | "destructeur" | null
          source?: "atteste" | "presume"
        }
        Update: {
          applique_par?: string | null
          appliquee_le?: string
          empreinte?: string
          nom?: string
          note?: string | null
          rejeu?: "sans-effet" | "leve" | "destructeur" | null
          source?: "atteste" | "presume"
        }
        Relationships: [
          {
            foreignKeyName: "migrations_appliquees_applique_par_fkey"
            columns: ["applique_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mouvements_inscription: {
        Row: {
          auteur_id: string | null
          auteur_nom: string | null
          class_id: string | null
          classe_nom: string | null
          cotisation_libelle: string | null
          cotisation_montant: number | null
          cotisation_type_id: string | null
          date_arrivee: string | null
          date_effet: string
          decide_le: string | null
          decide_par: string | null
          decision: "sans_ajustement" | "due" | "prorata" | null
          etablissement_id: string
          frais_inscription: number | null
          id: string
          motif: "affectation" | "correction" | "depart" | "statut"
          parent_id: string | null
          regle: "sans_ajustement" | "due" | "prorata" | "cas_par_cas"
          regle_initiale: string | null
          regle_modifiee_le: string | null
          regle_modifiee_par: string | null
          regle_modifiee_par_nom: string | null
          school_year_id: string | null
          sens: "arrivee" | "depart"
          student_id: string | null
          survenu_le: string
          tutor_number: 1 | 2 | null
        }
        Insert: {
          auteur_id?: string | null
          auteur_nom?: string | null
          class_id?: string | null
          classe_nom?: string | null
          cotisation_libelle?: string | null
          cotisation_montant?: number | null
          cotisation_type_id?: string | null
          date_arrivee?: string | null
          date_effet: string
          decide_le?: string | null
          decide_par?: string | null
          decision?: "sans_ajustement" | "due" | "prorata" | null
          etablissement_id: string
          frais_inscription?: number | null
          id?: string
          motif: "affectation" | "correction" | "depart" | "statut"
          parent_id?: string | null
          regle: "sans_ajustement" | "due" | "prorata" | "cas_par_cas"
          regle_initiale?: string | null
          regle_modifiee_le?: string | null
          regle_modifiee_par?: string | null
          regle_modifiee_par_nom?: string | null
          school_year_id?: string | null
          sens: "arrivee" | "depart"
          student_id?: string | null
          survenu_le?: string
          tutor_number?: 1 | 2 | null
        }
        Update: {
          auteur_id?: string | null
          auteur_nom?: string | null
          class_id?: string | null
          classe_nom?: string | null
          cotisation_libelle?: string | null
          cotisation_montant?: number | null
          cotisation_type_id?: string | null
          date_arrivee?: string | null
          date_effet?: string
          decide_le?: string | null
          decide_par?: string | null
          decision?: "sans_ajustement" | "due" | "prorata" | null
          etablissement_id?: string
          frais_inscription?: number | null
          id?: string
          motif?: "affectation" | "correction" | "depart" | "statut"
          parent_id?: string | null
          regle?: "sans_ajustement" | "due" | "prorata" | "cas_par_cas"
          regle_initiale?: string | null
          regle_modifiee_le?: string | null
          regle_modifiee_par?: string | null
          regle_modifiee_par_nom?: string | null
          school_year_id?: string | null
          sens?: "arrivee" | "depart"
          student_id?: string | null
          survenu_le?: string
          tutor_number?: 1 | 2 | null
        }
        Relationships: [
          {
            foreignKeyName: "mouvements_inscription_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_inscription_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_inscription_cotisation_type_id_fkey"
            columns: ["cotisation_type_id"]
            isOneToOne: false
            referencedRelation: "cotisation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_inscription_decide_par_fkey"
            columns: ["decide_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_inscription_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_inscription_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_inscription_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_inscription_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          email_status: "pending" | "sent" | "failed" | "skipped" | null
          etablissement_id: string
          id: string
          is_read: boolean | null
          metadata: Json | null
          parent_id: string
          push_status: "pending" | "sent" | "failed" | "no_sub" | null
          read_at: string | null
          student_id: string | null
          title: string
          type: "absence" | "retard" | "payment" | "announcement" | "homework"
        }
        Insert: {
          body: string
          created_at?: string | null
          email_status?: "pending" | "sent" | "failed" | "skipped" | null
          etablissement_id: string
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          parent_id: string
          push_status?: "pending" | "sent" | "failed" | "no_sub" | null
          read_at?: string | null
          student_id?: string | null
          title: string
          type: "absence" | "retard" | "payment" | "announcement" | "homework"
        }
        Update: {
          body?: string
          created_at?: string | null
          email_status?: "pending" | "sent" | "failed" | "skipped" | null
          etablissement_id?: string
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          parent_id?: string
          push_status?: "pending" | "sent" | "failed" | "no_sub" | null
          read_at?: string | null
          student_id?: string | null
          title?: string
          type?: "absence" | "retard" | "payment" | "announcement" | "homework"
        }
        Relationships: [
          {
            foreignKeyName: "notifications_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      other_revenues: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          etablissement_id: string
          id: string
          label: string
          notes: string | null
          revenue_date: string
          school_year_id: string
          source_type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          etablissement_id?: string
          id?: string
          label: string
          notes?: string | null
          revenue_date?: string
          school_year_id: string
          source_type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          etablissement_id?: string
          id?: string
          label?: string
          notes?: string | null
          revenue_date?: string
          school_year_id?: string
          source_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "other_revenues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_revenues_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_revenues_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_class_enrollments: {
        Row: {
          class_id: string
          created_at: string
          date_depart: string | null
          enrollment_date: string
          etablissement_id: string
          id: string
          parent_id: string
          status: "active" | "withdrawn"
          tutor_number: 1 | 2
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date_depart?: string | null
          enrollment_date?: string
          etablissement_id?: string
          id?: string
          parent_id: string
          status?: "active" | "withdrawn"
          tutor_number: 1 | 2
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date_depart?: string | null
          enrollment_date?: string
          etablissement_id?: string
          id?: string
          parent_id?: string
          status?: "active" | "withdrawn"
          tutor_number?: 1 | 2
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_class_enrollments_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_class_enrollments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string | null
          etablissement_id: string
          id: string
          notes: string | null
          situation_familiale: "mariés" | "pacsés" | "union_libre" | "séparés" | "divorcés" | "veuf_veuve" | "monoparental" | null
          tutor1_address: string | null
          tutor1_adult_courses: boolean
          tutor1_city: string | null
          tutor1_email: string
          tutor1_first_name: string
          tutor1_last_name: string
          tutor1_phone: string | null
          tutor1_postal_code: string | null
          tutor1_profession: string | null
          tutor1_relationship: "père" | "mère" | "tuteur" | "autre" | null
          tutor1_user_id: string | null
          tutor2_address: string | null
          tutor2_adult_courses: boolean
          tutor2_city: string | null
          tutor2_email: string | null
          tutor2_first_name: string | null
          tutor2_last_name: string | null
          tutor2_phone: string | null
          tutor2_postal_code: string | null
          tutor2_profession: string | null
          tutor2_relationship: "père" | "mère" | "tuteur" | "autre" | null
          tutor2_user_id: string | null
          type_garde: "alternée" | "exclusive_t1" | "exclusive_t2" | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          etablissement_id?: string
          id?: string
          notes?: string | null
          situation_familiale?: "mariés" | "pacsés" | "union_libre" | "séparés" | "divorcés" | "veuf_veuve" | "monoparental" | null
          tutor1_address?: string | null
          tutor1_adult_courses?: boolean
          tutor1_city?: string | null
          tutor1_email: string
          tutor1_first_name: string
          tutor1_last_name: string
          tutor1_phone?: string | null
          tutor1_postal_code?: string | null
          tutor1_profession?: string | null
          tutor1_relationship?: "père" | "mère" | "tuteur" | "autre" | null
          tutor1_user_id?: string | null
          tutor2_address?: string | null
          tutor2_adult_courses?: boolean
          tutor2_city?: string | null
          tutor2_email?: string | null
          tutor2_first_name?: string | null
          tutor2_last_name?: string | null
          tutor2_phone?: string | null
          tutor2_postal_code?: string | null
          tutor2_profession?: string | null
          tutor2_relationship?: "père" | "mère" | "tuteur" | "autre" | null
          tutor2_user_id?: string | null
          type_garde?: "alternée" | "exclusive_t1" | "exclusive_t2" | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          etablissement_id?: string
          id?: string
          notes?: string | null
          situation_familiale?: "mariés" | "pacsés" | "union_libre" | "séparés" | "divorcés" | "veuf_veuve" | "monoparental" | null
          tutor1_address?: string | null
          tutor1_adult_courses?: boolean
          tutor1_city?: string | null
          tutor1_email?: string
          tutor1_first_name?: string
          tutor1_last_name?: string
          tutor1_phone?: string | null
          tutor1_postal_code?: string | null
          tutor1_profession?: string | null
          tutor1_relationship?: "père" | "mère" | "tuteur" | "autre" | null
          tutor1_user_id?: string | null
          tutor2_address?: string | null
          tutor2_adult_courses?: boolean
          tutor2_city?: string | null
          tutor2_email?: string | null
          tutor2_first_name?: string | null
          tutor2_last_name?: string | null
          tutor2_phone?: string | null
          tutor2_postal_code?: string | null
          tutor2_profession?: string | null
          tutor2_relationship?: "père" | "mère" | "tuteur" | "autre" | null
          tutor2_user_id?: string | null
          type_garde?: "alternée" | "exclusive_t1" | "exclusive_t2" | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_tutor1_user_id_fkey"
            columns: ["tutor1_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_tutor2_user_id_fkey"
            columns: ["tutor2_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      periods: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          label: string
          order_index: number
          school_year_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          label: string
          order_index: number
          school_year_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          label?: string
          order_index?: number
          school_year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "periods_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_type_rates: {
        Row: {
          created_at: string
          etablissement_id: string
          id: string
          presence_type_id: string
          rate: number
          school_year_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          etablissement_id?: string
          id?: string
          presence_type_id: string
          rate?: number
          school_year_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          etablissement_id?: string
          id?: string
          presence_type_id?: string
          rate?: number
          school_year_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_type_rates_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_type_rates_presence_type_id_fkey"
            columns: ["presence_type_id"]
            isOneToOne: false
            referencedRelation: "presence_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_type_rates_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_types: {
        Row: {
          code: string
          color: string
          created_at: string | null
          etablissement_id: string
          id: string
          is_absence: boolean
          is_active: boolean
          label: string
          order_index: number
          reserved_kind: "absence" | "cours" | "activite" | null
          school_year_id: string
          updated_at: string | null
        }
        Insert: {
          code: string
          color?: string
          created_at?: string | null
          etablissement_id?: string
          id?: string
          is_absence?: boolean
          is_active?: boolean
          label: string
          order_index?: number
          reserved_kind?: "absence" | "cours" | "activite" | null
          school_year_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          color?: string
          created_at?: string | null
          etablissement_id?: string
          id?: string
          is_absence?: boolean
          is_active?: boolean
          label?: string
          order_index?: number
          reserved_kind?: "absence" | "cours" | "activite" | null
          school_year_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presence_types_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_types_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          civilite: string | null
          created_at: string | null
          email: string
          etablissement_id: string | null
          first_name: string
          id: string
          is_active: boolean | null
          last_name: string
          notes: string | null
          phone: string | null
          role: "super_admin" | "admin" | "direction" | "comptable" | "responsable_pedagogique" | "enseignant" | "secretaire" | "parent"
          theme: "light" | "dark" | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          civilite?: string | null
          created_at?: string | null
          email: string
          etablissement_id?: string | null
          first_name: string
          id: string
          is_active?: boolean | null
          last_name: string
          notes?: string | null
          phone?: string | null
          role: "super_admin" | "admin" | "direction" | "comptable" | "responsable_pedagogique" | "enseignant" | "secretaire" | "parent"
          theme?: "light" | "dark" | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          civilite?: string | null
          created_at?: string | null
          email?: string
          etablissement_id?: string | null
          first_name?: string
          id?: string
          is_active?: boolean | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          role?: "super_admin" | "admin" | "direction" | "comptable" | "responsable_pedagogique" | "enseignant" | "secretaire" | "parent"
          theme?: "light" | "dark" | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          etablissement_id: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          etablissement_id: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          etablissement_id?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      releves_facturation: {
        Row: {
          adultes_inscrits: number
          eleves_actifs: number
          etablissement_id: string
          forfait: number | null
          limite: number | null
          mois: string
          prix_inscrit: number | null
          releve_le: string
        }
        Insert: {
          adultes_inscrits: number
          eleves_actifs: number
          etablissement_id: string
          forfait?: number | null
          limite?: number | null
          mois: string
          prix_inscrit?: number | null
          releve_le?: string
        }
        Update: {
          adultes_inscrits?: number
          eleves_actifs?: number
          etablissement_id?: string
          forfait?: number | null
          limite?: number | null
          mois?: string
          prix_inscrit?: number | null
          releve_le?: string
        }
        Relationships: [
          {
            foreignKeyName: "releves_facturation_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          etablissement_id: string
          floor: string | null
          id: string
          is_available: boolean
          name: string
          room_type: "salle_cours" | "salle_informatique" | "bibliotheque" | "salle_reunion" | "salle_sport" | "administration" | "autre"
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          etablissement_id: string
          floor?: string | null
          id?: string
          is_available?: boolean
          name: string
          room_type?: "salle_cours" | "salle_informatique" | "bibliotheque" | "salle_reunion" | "salle_sport" | "administration" | "autre"
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          etablissement_id?: string
          floor?: string | null
          id?: string
          is_available?: boolean
          name?: string
          room_type?: "salle_cours" | "salle_informatique" | "bibliotheque" | "salle_reunion" | "salle_sport" | "administration" | "autre"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          etablissement_id: string
          exception_date: string
          exception_type: "cancelled" | "modified"
          id: string
          override_end_time: string | null
          override_room_id: string | null
          override_start_time: string | null
          override_teacher_id: string | null
          schedule_slot_id: string
        }
        Insert: {
          created_at?: string
          etablissement_id?: string
          exception_date: string
          exception_type: "cancelled" | "modified"
          id?: string
          override_end_time?: string | null
          override_room_id?: string | null
          override_start_time?: string | null
          override_teacher_id?: string | null
          schedule_slot_id: string
        }
        Update: {
          created_at?: string
          etablissement_id?: string
          exception_date?: string
          exception_type?: "cancelled" | "modified"
          id?: string
          override_end_time?: string | null
          override_room_id?: string | null
          override_start_time?: string | null
          override_teacher_id?: string | null
          schedule_slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_override_room_id_fkey"
            columns: ["override_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_override_teacher_id_fkey"
            columns: ["override_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_schedule_slot_id_fkey"
            columns: ["schedule_slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_slots: {
        Row: {
          class_id: string
          color: string | null
          cours_id: string | null
          created_at: string
          day_of_week: number | null
          effective_from: string | null
          effective_until: string | null
          end_time: string
          etablissement_id: string
          id: string
          is_active: boolean
          is_recurring: boolean
          libelle: string | null
          room_id: string | null
          school_year_id: string
          slot_date: string | null
          slot_type: "cours" | "activite"
          start_time: string
          teacher_id: string | null
          unite_enseignement_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          color?: string | null
          cours_id?: string | null
          created_at?: string
          day_of_week?: number | null
          effective_from?: string | null
          effective_until?: string | null
          end_time: string
          etablissement_id?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          libelle?: string | null
          room_id?: string | null
          school_year_id: string
          slot_date?: string | null
          slot_type?: "cours" | "activite"
          start_time: string
          teacher_id?: string | null
          unite_enseignement_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          color?: string | null
          cours_id?: string | null
          created_at?: string
          day_of_week?: number | null
          effective_from?: string | null
          effective_until?: string | null
          end_time?: string
          etablissement_id?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          libelle?: string | null
          room_id?: string | null
          school_year_id?: string
          slot_date?: string | null
          slot_type?: "cours" | "activite"
          start_time?: string
          teacher_id?: string | null
          unite_enseignement_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_cours_id_fkey"
            columns: ["cours_id"]
            isOneToOne: false
            referencedRelation: "cours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_unite_enseignement_id_fkey"
            columns: ["unite_enseignement_id"]
            isOneToOne: false
            referencedRelation: "unites_enseignement"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_validations: {
        Row: {
          created_at: string
          etablissement_id: string
          id: string
          profile_id: string
          schedule_slot_id: string
          time_entry_id: string | null
          validation_date: string
        }
        Insert: {
          created_at?: string
          etablissement_id?: string
          id?: string
          profile_id: string
          schedule_slot_id: string
          time_entry_id?: string | null
          validation_date: string
        }
        Update: {
          created_at?: string
          etablissement_id?: string
          id?: string
          profile_id?: string
          schedule_slot_id?: string
          time_entry_id?: string | null
          validation_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_validations_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_validations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_validations_schedule_slot_id_fkey"
            columns: ["schedule_slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_validations_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "staff_time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      school_years: {
        Row: {
          archived_at: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          end_date: string | null
          etablissement_id: string
          id: string
          is_current: boolean
          jours_feries: ColonnesJson['school_years.jours_feries']
          label: string
          period_type: "trimestrial" | "semestrial"
          purge_intent: "purge" | "keep" | null
          purged_at: string | null
          start_date: string | null
          vacations: ColonnesJson['school_years.vacations'] | null
        }
        Insert: {
          archived_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date?: string | null
          etablissement_id: string
          id?: string
          is_current?: boolean
          jours_feries?: ColonnesJson['school_years.jours_feries']
          label: string
          period_type?: "trimestrial" | "semestrial"
          purge_intent?: "purge" | "keep" | null
          purged_at?: string | null
          start_date?: string | null
          vacations?: ColonnesJson['school_years.vacations'] | null
        }
        Update: {
          archived_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date?: string | null
          etablissement_id?: string
          id?: string
          is_current?: boolean
          jours_feries?: ColonnesJson['school_years.jours_feries']
          label?: string
          period_type?: "trimestrial" | "semestrial"
          purge_intent?: "purge" | "keep" | null
          purged_at?: string | null
          start_date?: string | null
          vacations?: ColonnesJson['school_years.vacations'] | null
        }
        Relationships: [
          {
            foreignKeyName: "school_years_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_years_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_time_entries: {
        Row: {
          absence_reason: string | null
          created_at: string
          duration_minutes: number
          end_time: string | null
          entry_date: string
          entry_type: string
          etablissement_id: string
          id: string
          is_replacement: boolean
          notes: string | null
          profile_id: string
          recorded_by: string | null
          replaced_profile_id: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          absence_reason?: string | null
          created_at?: string
          duration_minutes?: number
          end_time?: string | null
          entry_date: string
          entry_type: string
          etablissement_id?: string
          id?: string
          is_replacement?: boolean
          notes?: string | null
          profile_id: string
          recorded_by?: string | null
          replaced_profile_id?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          absence_reason?: string | null
          created_at?: string
          duration_minutes?: number
          end_time?: string | null
          entry_date?: string
          entry_type?: string
          etablissement_id?: string
          id?: string
          is_replacement?: boolean
          notes?: string | null
          profile_id?: string
          recorded_by?: string | null
          replaced_profile_id?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_entries_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_entries_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_entries_replaced_profile_id_fkey"
            columns: ["replaced_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_documents: {
        Row: {
          category: "identite" | "medical" | "assurance" | "autres"
          created_at: string
          doc_type_key: string
          etablissement_id: string
          expires_at: string | null
          file_name: string
          file_url: string
          id: string
          student_id: string
          uploaded_by: string | null
        }
        Insert: {
          category: "identite" | "medical" | "assurance" | "autres"
          created_at?: string
          doc_type_key: string
          etablissement_id: string
          expires_at?: string | null
          file_name: string
          file_url: string
          id?: string
          student_id: string
          uploaded_by?: string | null
        }
        Update: {
          category?: "identite" | "medical" | "assurance" | "autres"
          created_at?: string
          doc_type_key?: string
          etablissement_id?: string
          expires_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          student_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_documents_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_warning_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          warning_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          warning_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          warning_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_warning_attachments_warning_id_fkey"
            columns: ["warning_id"]
            isOneToOne: false
            referencedRelation: "student_warnings"
            referencedColumns: ["id"]
          },
        ]
      }
      student_warnings: {
        Row: {
          class_id: string
          created_at: string
          etablissement_id: string
          id: string
          issued_by: string | null
          motif: string
          period_id: string
          severity: "punition" | "prevention" | "conservatoire" | "sanction"
          student_id: string
          warning_date: string
        }
        Insert: {
          class_id: string
          created_at?: string
          etablissement_id: string
          id?: string
          issued_by?: string | null
          motif?: string
          period_id: string
          severity: "punition" | "prevention" | "conservatoire" | "sanction"
          student_id: string
          warning_date?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          etablissement_id?: string
          id?: string
          issued_by?: string | null
          motif?: string
          period_id?: string
          severity?: "punition" | "prevention" | "conservatoire" | "sanction"
          student_id?: string
          warning_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_warnings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_warnings_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_warnings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_warnings_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_warnings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_year_history: {
        Row: {
          absences_justified: number
          absences_unjustified: number
          bulletin_refs: Json
          class_name: string | null
          cotisation_label: string | null
          created_at: string
          date_depart: string | null
          etablissement_id: string
          financial_status: string | null
          first_name: string
          id: string
          last_name: string
          level: string | null
          moyenne_generale: number | null
          parent_id: string | null
          participant_type: "student" | "adult"
          school_year_id: string | null
          student_id: string | null
          student_number: string | null
          total_due: number | null
          total_paid: number | null
          tutor_number: number | null
          year_label: string
        }
        Insert: {
          absences_justified?: number
          absences_unjustified?: number
          bulletin_refs?: Json
          class_name?: string | null
          cotisation_label?: string | null
          created_at?: string
          date_depart?: string | null
          etablissement_id: string
          financial_status?: string | null
          first_name: string
          id?: string
          last_name: string
          level?: string | null
          moyenne_generale?: number | null
          parent_id?: string | null
          participant_type: "student" | "adult"
          school_year_id?: string | null
          student_id?: string | null
          student_number?: string | null
          total_due?: number | null
          total_paid?: number | null
          tutor_number?: number | null
          year_label: string
        }
        Update: {
          absences_justified?: number
          absences_unjustified?: number
          bulletin_refs?: Json
          class_name?: string | null
          cotisation_label?: string | null
          created_at?: string
          date_depart?: string | null
          etablissement_id?: string
          financial_status?: string | null
          first_name?: string
          id?: string
          last_name?: string
          level?: string | null
          moyenne_generale?: number | null
          parent_id?: string | null
          participant_type?: "student" | "adult"
          school_year_id?: string | null
          student_id?: string | null
          student_number?: string | null
          total_due?: number | null
          total_paid?: number | null
          tutor_number?: number | null
          year_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_year_history_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_year_history_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_year_history_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_year_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          date_of_birth: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          enrollment_date: string | null
          etablissement_id: string
          exit_authorization: boolean
          first_name: string
          gender: "male" | "female" | "non_specified" | null
          has_pai: boolean
          id: string
          is_active: boolean | null
          last_name: string
          media_authorization: boolean
          medical_notes: string | null
          pai_notes: string | null
          parent_id: string | null
          photo_url: string | null
          postal_code: string | null
          student_number: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrollment_date?: string | null
          etablissement_id?: string
          exit_authorization?: boolean
          first_name: string
          gender?: "male" | "female" | "non_specified" | null
          has_pai?: boolean
          id?: string
          is_active?: boolean | null
          last_name: string
          media_authorization?: boolean
          medical_notes?: string | null
          pai_notes?: string | null
          parent_id?: string | null
          photo_url?: string | null
          postal_code?: string | null
          student_number: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrollment_date?: string | null
          etablissement_id?: string
          exit_authorization?: boolean
          first_name?: string
          gender?: "male" | "female" | "non_specified" | null
          has_pai?: boolean
          id?: string
          is_active?: boolean | null
          last_name?: string
          media_authorization?: boolean
          medical_notes?: string | null
          pai_notes?: string | null
          parent_id?: string | null
          photo_url?: string | null
          postal_code?: string | null
          student_number?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_interventions: {
        Row: {
          closed_at: string | null
          closed_reason: "manuelle" | "expiration" | null
          etablissement_id: string
          id: string
          opened_at: string
          super_admin_email: string | null
          super_admin_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_reason?: "manuelle" | "expiration" | null
          etablissement_id: string
          id?: string
          opened_at?: string
          super_admin_email?: string | null
          super_admin_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_reason?: "manuelle" | "expiration" | null
          etablissement_id?: string
          id?: string
          opened_at?: string
          super_admin_email?: string | null
          super_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_interventions_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_interventions_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          attachment_path: string | null
          author_email: string
          author_name: string
          author_role: string
          category: "assistance" | "incident" | "information" | "suggestion" | "facturation" | "autre"
          context: Json
          created_at: string
          created_by: string | null
          email_error: string | null
          email_status: "pending" | "sent" | "failed"
          etablissement_id: string
          id: string
          impact: "bloquant" | "genant" | "mineur" | null
          message: string
          subject: string
        }
        Insert: {
          attachment_path?: string | null
          author_email: string
          author_name: string
          author_role: string
          category: "assistance" | "incident" | "information" | "suggestion" | "facturation" | "autre"
          context?: Json
          created_at?: string
          created_by?: string | null
          email_error?: string | null
          email_status?: "pending" | "sent" | "failed"
          etablissement_id: string
          id?: string
          impact?: "bloquant" | "genant" | "mineur" | null
          message: string
          subject: string
        }
        Update: {
          attachment_path?: string | null
          author_email?: string
          author_name?: string
          author_role?: string
          category?: "assistance" | "incident" | "information" | "suggestion" | "facturation" | "autre"
          context?: Json
          created_at?: string
          created_by?: string | null
          email_error?: string | null
          email_status?: "pending" | "sent" | "failed"
          etablissement_id?: string
          id?: string
          impact?: "bloquant" | "genant" | "mineur" | null
          message?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_documents: {
        Row: {
          category: "contrat" | "cv" | "diplome" | "identite" | "autre"
          created_at: string
          etablissement_id: string
          expires_at: string | null
          file_name: string
          file_url: string
          id: string
          label: string | null
          teacher_id: string
          uploaded_by: string | null
        }
        Insert: {
          category: "contrat" | "cv" | "diplome" | "identite" | "autre"
          created_at?: string
          etablissement_id: string
          expires_at?: string | null
          file_name: string
          file_url: string
          id?: string
          label?: string | null
          teacher_id: string
          uploaded_by?: string | null
        }
        Update: {
          category?: "contrat" | "cv" | "diplome" | "identite" | "autre"
          created_at?: string
          etablissement_id?: string
          expires_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          label?: string | null
          teacher_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_documents_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_documents_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          civilite: string | null
          created_at: string | null
          email: string
          employee_number: string
          etablissement_id: string
          first_name: string
          hire_date: string | null
          id: string
          is_active: boolean | null
          last_name: string
          notes: string | null
          phone: string | null
          specialization: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          civilite?: string | null
          created_at?: string | null
          email: string
          employee_number: string
          etablissement_id?: string
          first_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          last_name: string
          notes?: string | null
          phone?: string | null
          specialization?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          civilite?: string | null
          created_at?: string | null
          email?: string
          employee_number?: string
          etablissement_id?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          specialization?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unites_enseignement: {
        Row: {
          code: string | null
          color: string | null
          created_at: string | null
          etablissement_id: string
          id: string
          nom_ar: string | null
          nom_fr: string
          order_index: number | null
        }
        Insert: {
          code?: string | null
          color?: string | null
          created_at?: string | null
          etablissement_id: string
          id?: string
          nom_ar?: string | null
          nom_fr: string
          order_index?: number | null
        }
        Update: {
          code?: string | null
          color?: string | null
          created_at?: string | null
          etablissement_id?: string
          id?: string
          nom_ar?: string | null
          nom_fr?: string
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "unites_enseignement_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      year_audits: {
        Row: {
          anomalies_count: number
          audited_at: string
          audited_by: string | null
          etablissement_id: string
          id: string
          recap_json: Json
          school_year_id: string
          step_key: string
        }
        Insert: {
          anomalies_count?: number
          audited_at?: string
          audited_by?: string | null
          etablissement_id: string
          id?: string
          recap_json?: Json
          school_year_id: string
          step_key: string
        }
        Update: {
          anomalies_count?: number
          audited_at?: string
          audited_by?: string | null
          etablissement_id?: string
          id?: string
          recap_json?: Json
          school_year_id?: string
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "year_audits_audited_by_fkey"
            columns: ["audited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_audits_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_audits_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_profile_only: {
        Args: { p_profile_id: string | null }
        Returns: undefined
      }
      cleanup_user_and_parent: {
        Args: { p_profile_id: string | null }
        Returns: undefined
      }
      cleanup_user_and_teacher: {
        Args: { p_profile_id: string | null }
        Returns: undefined
      }
      create_parent_login_profile: {
        Args: {
          p_email: string | null
          p_etablissement_id: string | null
          p_first_name: string | null
          p_last_name: string | null
          p_phone: string | null
          p_profile_id: string | null
        }
        Returns: string
      }
      create_profile_and_parent: {
        Args: {
          p_email: string | null
          p_etablissement_id: string | null
          p_first_name: string | null
          p_is_active: boolean | null
          p_last_name: string | null
          p_notes: string | null
          p_phone: string | null
          p_profile_id: string | null
          p_role: string | null
          p_situation_familiale: string | null
          p_tutor1_address: string | null
          p_tutor1_adult_courses: boolean | null
          p_tutor1_city: string | null
          p_tutor1_email: string | null
          p_tutor1_first_name: string | null
          p_tutor1_last_name: string | null
          p_tutor1_phone: string | null
          p_tutor1_postal_code: string | null
          p_tutor1_profession: string | null
          p_tutor1_relationship: string | null
          p_tutor2_address: string | null
          p_tutor2_adult_courses: boolean | null
          p_tutor2_city: string | null
          p_tutor2_email: string | null
          p_tutor2_first_name: string | null
          p_tutor2_last_name: string | null
          p_tutor2_phone: string | null
          p_tutor2_postal_code: string | null
          p_tutor2_profession: string | null
          p_tutor2_relationship: string | null
          p_type_garde: string | null
        }
        Returns: string
      }
      create_profile_and_teacher: {
        Args: {
          p_civilite: string | null
          p_email: string | null
          p_employee_number: string | null
          p_etablissement_id: string | null
          p_first_name: string | null
          p_hire_date: string | null
          p_is_active: boolean | null
          p_last_name: string | null
          p_phone: string | null
          p_profile_id: string | null
          p_role: string | null
          p_specialization: string | null
        }
        Returns: string
      }
      create_profile_only: {
        Args: {
          p_civilite: string | null
          p_email: string | null
          p_etablissement_id: string | null
          p_first_name: string | null
          p_is_active: boolean | null
          p_last_name: string | null
          p_phone: string | null
          p_profile_id: string | null
          p_role: string | null
        }
        Returns: string
      }
      current_etablissement_id: { Args: never; Returns: string }
      decider_mouvement: {
        Args: { p_decision: string | null; p_id: string | null }
        Returns: undefined
      }
      decider_seances_absence: {
        Args: { p_absence_id: string | null; p_decisions: Json | null }
        Returns: Json
      }
      declarer_depart_adulte: {
        Args: {
          p_class_id: string | null
          p_date: string | null
          p_parent_id: string | null
          p_tutor_number: number | null
        }
        Returns: undefined
      }
      declarer_depart_eleve: {
        Args: { p_date: string | null; p_student_id: string | null }
        Returns: undefined
      }
      definir_regle_ajustement: {
        Args: { p_regle: string | null; p_retroactif?: boolean | null }
        Returns: number
      }
      demo_couper_sessions: { Args: { p_user: string | null }; Returns: number }
      effacer_etablissement: {
        Args: {
          p_auteur: string | null
          p_id: string | null
          p_reel: boolean | null
          p_slug: string | null
        }
        Returns: Json
      }
      enregistrer_absence_enseignant: {
        Args: {
          p_debut: string | null
          p_fin: string | null
          p_id: string | null
          p_motif: string | null
          p_teacher_id: string | null
        }
        Returns: string
      }
      enregistrer_migration: {
        Args: {
          p_empreinte: string | null
          p_nom: string | null
          p_note?: string | null
          p_rejeu?: string | null
        }
        Returns: undefined
      }
      est_destinataire_annonce: {
        Args: { p_announcement_id: string | null }
        Returns: boolean
      }
      exporter_etablissement: { Args: { p_id: string | null }; Returns: Json }
      fin_ajouter_reduction: {
        Args: { p_fee_id: string | null; p_reduction: Json | null; p_subtotal: number | null }
        Returns: Json
      }
      fin_enregistrer_paiement: {
        Args: {
          p_fee_id: string | null
          p_paiement: Json | null
          p_payment_id?: string | null
          p_subtotal: number | null
        }
        Returns: Json
      }
      fin_garde_dossier: { Args: { p_fee_id: string | null }; Returns: undefined }
      fin_recalculer_dossier: {
        Args: { p_fee_id: string | null; p_subtotal: number | null }
        Returns: Json
      }
      fin_statut_dossier: {
        Args: { p_due: number | null; p_paid: number | null }
        Returns: string
      }
      fin_supprimer_paiement: {
        Args: { p_payment_id: string | null; p_subtotal: number | null }
        Returns: Json
      }
      fin_supprimer_reduction: {
        Args: { p_adjustment_id: string | null; p_subtotal: number | null }
        Returns: Json
      }
      fn_absences_garde: { Args: never; Returns: string }
      fn_absences_verifier_non_validees: {
        Args: { p_ids: string[] | null }
        Returns: undefined
      }
      fn_adulte_a_donnees: {
        Args: {
          p_class_id: string | null
          p_parent_id: string | null
          p_tutor_number: number | null
        }
        Returns: boolean
      }
      fn_annee_courante_bornes: { Args: { p_date: string | null }; Returns: undefined }
      fn_base_facturable: {
        Args: { p_etab: string | null }
        Returns: {
          adultes_inscrits: number
          eleves_actifs: number
        }[]
      }
      fn_demo_peupler: { Args: { p_id: string | null }; Returns: Json }
      fn_demo_vider: { Args: { p_id: string | null }; Returns: undefined }
      fn_depart_tables: {
        Args: never
        Returns: {
          efface: boolean
          exporte: boolean
          filtre: string
          nom: string
        }[]
      }
      fn_effacement_en_cours: { Args: never; Returns: boolean }
      fn_eleve_a_donnees: {
        Args: { p_class_id: string | null; p_student_id: string | null }
        Returns: boolean
      }
      fn_ensure_reserved_presence_types: {
        Args: { p_etab: string | null; p_year: string | null }
        Returns: undefined
      }
      fn_expirer_interventions_support: { Args: never; Returns: number }
      fn_membre_occupe: {
        Args: {
          p_date: string | null
          p_debut: string | null
          p_exclure_slot: string | null
          p_fin: string | null
          p_profile_id: string | null
        }
        Returns: string
      }
      fn_mouvement_inscrire: {
        Args: {
          p_class_id: string | null
          p_date_arrivee: string | null
          p_date_effet: string | null
          p_motif: string | null
          p_parent_id: string | null
          p_sens: string | null
          p_student_id: string | null
          p_tutor_number: number | null
        }
        Returns: undefined
      }
      fn_releve_facturation: { Args: never; Returns: number }
      fn_remplace_classe: { Args: { p_class_id: string | null }; Returns: boolean }
      fn_role_remplacant: { Args: { p_role: string | null }; Returns: boolean }
      fn_seance_a_lieu: {
        Args: { p_date: string | null; p_slot_id: string | null }
        Returns: boolean
      }
      fn_titulaire_de: {
        Args: { p_class_id: string | null; p_date: string | null }
        Returns: string
      }
      get_etablissements_sante: {
        Args: never
        Returns: {
          base_facturable: number
          classes_count: number
          etablissement_id: string
          last_sign_in: string
          smtp_configured: boolean
          students_count: number
          users_count: number
        }[]
      }
      get_user_role: { Args: never; Returns: string }
      get_verified_totp_user_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      import_foyer: {
        Args: { p_enfants: Json | null; p_foyer: Json | null; p_foyer_id?: string | null }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      norm_name: { Args: { txt: string | null }; Returns: string }
      purge_school_year: { Args: { p_year_id: string | null }; Returns: Json }
      reinitialiser_ecole_demo: { Args: { p_id: string | null }; Returns: Json }
      remplacants_possibles: {
        Args: { p_absence_id: string | null; p_seances: Json | null }
        Returns: {
          occupe: string
          profile_id: string
          seance_date: string
          slot_id: string
        }[]
      }
      retirer_validation_seance: {
        Args: { p_date: string | null; p_slot_id: string | null }
        Returns: undefined
      }
      set_teacher_profile_active: {
        Args: { p_active: boolean | null; p_teacher_id: string | null }
        Returns: undefined
      }
      supprimer_absence_enseignant: {
        Args: { p_id: string | null }
        Returns: undefined
      }
      teaches_class: { Args: { p_class_id: string | null }; Returns: boolean }
      teaches_parent: { Args: { p_parent_id: string | null }; Returns: boolean }
      teaches_student: { Args: { p_student_id: string | null }; Returns: boolean }
      valider_seance: {
        Args: { p_date: string | null; p_slot_id: string | null }
        Returns: Json
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
