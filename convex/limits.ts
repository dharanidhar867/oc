// Single place for the course-content rules. Change a number here and it applies everywhere (server-enforced).
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_LESSON_SECONDS = 15 * 60 + 5; // 15 min (+5 s for rounding in the browser's duration reading)
export const MAX_PROMO_SECONDS = 2 * 60 + 5; // 2 min
export const MAX_LESSONS_PER_COURSE = 100;
export const MAX_SECTIONS_PER_COURSE = 30;
export const LESSON_UPLOADS_PER_DAY = 2;
export const PROMO_UPLOADS_PER_DAY = 5;
export const MIN_COURSE_SECONDS = 0; // no minimum total length: a course can be submitted once it has a lesson
export const MIN_LESSONS = 1;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const VIDEO_TYPES = ["video/webm"]; // the browser converts MP4 -> WebM before upload
