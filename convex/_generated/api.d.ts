/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as captcha from "../captcha.js";
import type * as cart from "../cart.js";
import type * as catalog from "../catalog.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as dodo from "../dodo.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as learning from "../learning.js";
import type * as lessons from "../lessons.js";
import type * as limits from "../limits.js";
import type * as maintenance from "../maintenance.js";
import type * as model from "../model.js";
import type * as payments from "../payments.js";
import type * as seed from "../seed.js";
import type * as tree from "../tree.js";
import type * as uploads from "../uploads.js";
import type * as video from "../video.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  captcha: typeof captcha;
  cart: typeof cart;
  catalog: typeof catalog;
  courses: typeof courses;
  crons: typeof crons;
  dodo: typeof dodo;
  email: typeof email;
  http: typeof http;
  learning: typeof learning;
  lessons: typeof lessons;
  limits: typeof limits;
  maintenance: typeof maintenance;
  model: typeof model;
  payments: typeof payments;
  seed: typeof seed;
  tree: typeof tree;
  uploads: typeof uploads;
  video: typeof video;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
