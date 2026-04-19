import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gameRouter from "./game";
import gamesRouter from "./games";
import analyzeRouter from "./analyze";
import chatRouter from "./chat";
import profileRouter from "./profile";
import leaderboardRouter from "./leaderboard";
import friendsRouter from "./friends";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(gameRouter);
router.use(gamesRouter);
router.use(analyzeRouter);
router.use(chatRouter);
router.use(profileRouter);
router.use(leaderboardRouter);
router.use(friendsRouter);

export default router;
