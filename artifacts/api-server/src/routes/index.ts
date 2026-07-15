import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import filesystemRouter from "./filesystem";
import githubRouter from "./github";
import aiRouter from "./ai";
import apiKeysRouter from "./apikeys";
import usageRouter from "./usage";
import settingsRouter from "./settings";
import modelsRouter from "./models";
import criteriaRouter from "./criteria";
import memoryRouter from "./memory";
import aiActionsRouter from "./ai-actions";
import workflowsRouter from "./workflows";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// ── Public: health + the sign-in flow itself ────────────────────
router.use(healthRouter);
router.use(authRouter);

// ── Data routes: require a session (or AUTH_DISABLED local mode) ─
router.use(requireAuth);

router.use(projectsRouter);
router.use(filesystemRouter);
router.use(githubRouter);
router.use(aiRouter);
router.use(apiKeysRouter);
router.use(usageRouter);
router.use(settingsRouter);
router.use(modelsRouter);
router.use(criteriaRouter);
router.use(memoryRouter);
router.use(aiActionsRouter);
router.use(workflowsRouter);

export default router;
