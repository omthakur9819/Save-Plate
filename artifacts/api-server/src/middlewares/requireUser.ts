import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { db, marketplaceUsersTable } from "@workspace/db";

export const requireUser: RequestHandler = async (req, res, next) => {
  try {
    const clerkId = getAuth(req).userId;
    const headerId = (req.headers["x-marketplace-user-id"] as string | undefined)?.trim();
    const userId = clerkId || headerId || "demo-consumer-1";

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
