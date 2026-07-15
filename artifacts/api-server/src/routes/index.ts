import { Router, type IRouter } from "express";
import healthRouter from "./health";
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
import { localUser } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);

// ── Data routes: attributed to the implicit local user ──────────
router.use(localUser);

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

export default router;
