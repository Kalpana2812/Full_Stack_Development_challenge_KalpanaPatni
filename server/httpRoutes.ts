import type { Express, Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import { createContext } from "./_core/context";
import { getActiveCatalogue, getCmsOverview, getValidationReport, publishCatalogue, searchActiveCatalogue } from "./catalogueService";
import { deleteContent, listCmsEpisodes, saveEpisode, saveSeason, saveShow, uploadArtwork } from "./cmsService";

function sendError(res: Response, status: number, message: string, details?: unknown) {
  return res.status(status).json({ error: message, details });
}

async function requireRole(req: Request, res: Response, roles: Array<"editor" | "admin">) {
  const context = await createContext({ req, res } as unknown as Parameters<typeof createContext>[0]);
  if (!context.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to access the CMS." });
  if (!roles.includes(context.user.role as "editor" | "admin")) throw new TRPCError({ code: "FORBIDDEN", message: "Your role does not have permission for this action." });
  return context.user;
}

export function registerCatalogueRoutes(app: Express) {
  app.get("/api/health", (_req, res) => res.status(200).json({ status: "ok", service: "peblo-tv-mini" }));
  app.get("/catalog", async (_req, res) => {
    const catalogue = await getActiveCatalogue();
    if (!catalogue) return sendError(res, 503, "The first catalogue has not been published yet.");
    return res.json(catalogue);
  });
  app.get("/catalog/search", async (req, res) => {
    const catalogue = await searchActiveCatalogue({
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      language: typeof req.query.language === "string" ? req.query.language : undefined,
      section: typeof req.query.section === "string" ? req.query.section : undefined,
    });
    if (!catalogue) return sendError(res, 503, "The first catalogue has not been published yet.");
    return res.json(catalogue);
  });
  app.get("/admin/validation-report", async (req, res) => {
    try { await requireRole(req, res, ["editor", "admin"]); return res.json(await getValidationReport()); }
    catch (error) { return sendError(res, error instanceof TRPCError && error.code === "UNAUTHORIZED" ? 401 : 403, error instanceof Error ? error.message : "Unauthorized"); }
  });
  app.get("/admin/shows", async (req, res) => {
    try { await requireRole(req, res, ["editor", "admin"]); return res.json(await getCmsOverview()); }
    catch (error) { return sendError(res, error instanceof TRPCError && error.code === "UNAUTHORIZED" ? 401 : 403, error instanceof Error ? error.message : "Unauthorized"); }
  });
  app.get("/admin/episodes", async (req, res) => {
    try {
      await requireRole(req, res, ["editor", "admin"]);
      return res.json(await listCmsEpisodes({ query: typeof req.query.query === "string" ? req.query.query : undefined, section: typeof req.query.section === "string" ? req.query.section : undefined, language: typeof req.query.language === "string" ? req.query.language : undefined, status: req.query.status === "draft" || req.query.status === "published" ? req.query.status : undefined, page: Number(req.query.page) || 1, pageSize: Number(req.query.pageSize) || 10 }));
    } catch (error) { return sendError(res, error instanceof TRPCError && error.code === "UNAUTHORIZED" ? 401 : 403, error instanceof Error ? error.message : "Unauthorized"); }
  });
  app.post("/admin/shows", async (req, res) => {
    try { await requireRole(req, res, ["editor", "admin"]); return res.status(201).json({ id: await saveShow(req.body) }); }
    catch (error) { return sendError(res, 422, error instanceof Error ? error.message : "Unable to save show"); }
  });
  app.patch("/admin/shows/:id", async (req, res) => {
    try { await requireRole(req, res, ["editor", "admin"]); return res.json({ id: await saveShow({ ...req.body, id: Number(req.params.id) }) }); }
    catch (error) { return sendError(res, 422, error instanceof Error ? error.message : "Unable to save show"); }
  });
  app.post("/admin/seasons", async (req, res) => {
    try { await requireRole(req, res, ["editor", "admin"]); return res.status(201).json({ id: await saveSeason(req.body) }); }
    catch (error) { return sendError(res, 422, error instanceof Error ? error.message : "Unable to save season"); }
  });
  app.patch("/admin/seasons/:id", async (req, res) => {
    try { await requireRole(req, res, ["editor", "admin"]); return res.json({ id: await saveSeason({ ...req.body, id: Number(req.params.id) }) }); }
    catch (error) { return sendError(res, 422, error instanceof Error ? error.message : "Unable to save season"); }
  });
  app.post("/admin/episodes", async (req, res) => {
    try { await requireRole(req, res, ["editor", "admin"]); return res.status(201).json({ id: await saveEpisode(req.body) }); }
    catch (error) { return sendError(res, 422, error instanceof Error ? error.message : "Unable to save episode"); }
  });
  app.patch("/admin/episodes/:id", async (req, res) => {
    try { await requireRole(req, res, ["editor", "admin"]); return res.json({ id: await saveEpisode({ ...req.body, id: Number(req.params.id) }) }); }
    catch (error) { return sendError(res, 422, error instanceof Error ? error.message : "Unable to save episode"); }
  });
  app.delete("/admin/:kind(show|season|episode)/:id", async (req, res) => {
    try { await requireRole(req, res, ["editor", "admin"]); return res.json(await deleteContent(req.params.kind as "show" | "season" | "episode", Number(req.params.id))); }
    catch (error) { return sendError(res, error instanceof TRPCError && error.code === "UNAUTHORIZED" ? 401 : 403, error instanceof Error ? error.message : "Unable to delete content"); }
  });
  app.post("/admin/catalog/publish", async (req, res) => {
    try {
      const user = await requireRole(req, res, ["admin"]);
      const result = await publishCatalogue(user.id);
      if (!result.ok) return res.status(422).json({ error: "Publishing is blocked until the validation issues are fixed.", report: result.report });
      return res.status(201).json({ version: result.version, runId: result.runId, catalogue: result.payload });
    } catch (error) { return sendError(res, error instanceof TRPCError && error.code === "UNAUTHORIZED" ? 401 : 403, error instanceof Error ? error.message : "Unable to publish"); }
  });
  app.post("/admin/artwork/upload", async (req, res) => {
    try {
      await requireRole(req, res, ["editor", "admin"]);
      const { kind, showId, episodeId, filename, dataBase64 } = req.body ?? {};
      if (!["poster", "banner", "thumbnail"].includes(kind) || !showId || !filename || !dataBase64) return sendError(res, 400, "Provide a show, artwork type, file name, and image data.");
      const uploaded = await uploadArtwork({ kind, showId: Number(showId), episodeId: episodeId ? Number(episodeId) : null, filename, dataBase64 });
      return res.status(201).json(uploaded);
    } catch (error) { return sendError(res, error instanceof TRPCError && error.code === "UNAUTHORIZED" ? 401 : 403, error instanceof Error ? error.message : "Unable to upload artwork"); }
  });
}
