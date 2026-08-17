import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getCmsOverview, getValidationReport, publishCatalogue, searchActiveCatalogue } from "./catalogueService";
import { deleteContent, listCmsEpisodes, listCmsSeasons, saveEpisode, saveSeason, saveShow, uploadArtwork } from "./cmsService";
import { isLocalAdminModeEnabled, matchesLocalAdminPassword } from "./localAuth";

const editorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "editor" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Editor or admin access is required." });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    localStatus: publicProcedure.query(() => ({ enabled: isLocalAdminModeEnabled() })),
    localLogin: publicProcedure.input(z.object({ password: z.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      if (!isLocalAdminModeEnabled()) throw new TRPCError({ code: "FORBIDDEN", message: "Local admin mode is disabled." });
      if (!matchesLocalAdminPassword(process.env.LOCAL_ADMIN_PASSWORD, input.password)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect local admin password." });
      }
      const openId = "local-docker-admin";
      await db.upsertUser({ openId, name: "Local Administrator", loginMethod: "local-password", role: "admin", lastSignedIn: new Date() });
      const user = await db.getUserByOpenId(openId);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create local administrator." });
      const token = await sdk.createSessionToken(openId, { name: "Local Administrator", expiresInMs: 1000 * 60 * 60 * 12 });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 12 });
      return user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  catalogue: router({
    get: publicProcedure.query(async () => searchActiveCatalogue({})),
    search: publicProcedure.input(z.object({ q: z.string().optional(), category: z.string().optional(), language: z.string().optional(), section: z.string().optional() })).query(async ({ input }) => searchActiveCatalogue(input)),
  }),
  cms: router({
    overview: editorProcedure.query(async () => getCmsOverview()),
    validationReport: editorProcedure.query(async () => getValidationReport()),
    episodes: editorProcedure.input(z.object({ query: z.string().optional(), showId: z.number().int().positive().optional(), section: z.string().optional(), status: z.enum(["draft", "published"]).optional(), language: z.string().optional(), page: z.number().optional(), pageSize: z.number().optional() }).optional()).query(async ({ input }) => listCmsEpisodes(input ?? {})),
    seasons: editorProcedure.input(z.object({ showId: z.number().int().positive() }).optional()).query(async ({ input }) => listCmsSeasons(input?.showId)),
    saveShow: editorProcedure.input(z.object({ id: z.number().optional(), title: z.string().min(1), slug: z.string().min(1), section: z.string().nullable().optional(), categories: z.array(z.string()).min(1), synopsis: z.string().min(1), status: z.enum(["draft", "published"]) })).mutation(({ input }) => saveShow(input)),
    saveSeason: editorProcedure.input(z.object({ id: z.number().optional(), showId: z.number(), number: z.number().int().min(0) })).mutation(({ input }) => saveSeason(input)),
    saveEpisode: editorProcedure.input(z.object({ id: z.number().optional(), showId: z.number(), seasonId: z.number(), sourceEpisodeId: z.string().min(1), episodeNumber: z.number().int().min(0), title: z.string().min(1), durationSeconds: z.number().int().positive().nullable().optional(), language: z.enum(["en", "hi"]), contentGroup: z.string().min(1), status: z.enum(["draft", "published"]), declaredArtworkKinds: z.array(z.string()).optional() })).mutation(({ input }) => saveEpisode(input)),
    uploadArtwork: editorProcedure.input(z.object({ kind: z.enum(["poster", "banner", "thumbnail"]), showId: z.number().int().positive(), episodeId: z.number().int().positive().nullable().optional(), filename: z.string().min(1), dataBase64: z.string().min(1).max(280000) })).mutation(({ input }) => uploadArtwork(input)),
    deleteContent: editorProcedure.input(z.object({ kind: z.enum(["show", "season", "episode"]), id: z.number().int().positive() })).mutation(({ input }) => deleteContent(input.kind, input.id)),
    publish: adminProcedure.mutation(async ({ ctx }) => {
      const result = await publishCatalogue(ctx.user.id);
      if (!result.ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Publishing is blocked until the validation issues are fixed.", cause: result.report });
      return result;
    }),
  }),
});

export type AppRouter = typeof appRouter;
