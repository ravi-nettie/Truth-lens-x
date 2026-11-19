/**
 * frontend/src/mocks/browser.ts
 *
 * Configures Mock Service Worker for client-side mocking in dev mode.
 */

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

