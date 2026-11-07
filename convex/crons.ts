import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Remove expired sessions, sign-up codes, login-failure records and rate-limit counters.
crons.interval("security cleanup", { hours: 6 }, internal.maintenance.cleanup, {});

export default crons;
