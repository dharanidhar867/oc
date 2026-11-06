// Types shared by the moderation UI. The data and every permission check live in Convex (convex/admin.ts, convex/courses.ts).

export type CourseStatus = "draft" | "in_review" | "live" | "rejected" | "taken_down";

export type Submission = {
  id: string;
  instructorId: string;
  instructorName: string;
  title: string;
  subtitle: string;
  category: string;
  level: string;
  price: number;
  description: string;
  thumbnail: string;
  status: CourseStatus;
  reason?: string;
  _creationTime: number;
  updatedAt: number;
};

export type AuditEntry = { id: string; at: number; admin: string; action: string; target: string };
