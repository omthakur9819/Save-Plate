import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { db, marketplaceUsersTable } from "@workspace/db";

export const requireUser: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Sign in to use this marketplace feature." });
      return;
    }

    await db
      .insert(marketplaceUsersTable)
      .values({ id: userId })
      .onConflictDoNothing({ target: marketplaceUsersTable.id });
    res.locals.marketplaceUserId = userId;
    next();
  } catch (error) {
    next(error);
  }
};
