import { router } from "./trpc";
import { patientRouter } from "./routers/patient";
import { documentRouter } from "./routers/document";
import { chatRouter } from "./routers/chat";
import { escalationRouter } from "./routers/escalation";
import { auditRouter } from "./routers/audit";

export const appRouter = router({
  patient: patientRouter,
  document: documentRouter,
  chat: chatRouter,
  escalation: escalationRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;
