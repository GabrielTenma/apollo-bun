// src/routes/v1/supabase.route.ts
// Supabase CRUD routes under /api/v1/supabase/.
// dep: app.ts decorates 'supabaseService' (an instance of SupabaseService).

import { Elysia } from "elysia";
import { supabasePlugin } from "../../plugins/supabasePlugin.ts";

const supabaseRoutes = new Elysia({
	prefix: "/supabase",
	name: "supabaseRoutes",
})
	// supabasePlugin needs to be present so its decorations are available
	.use(supabasePlugin)

	.get("/health", () => ({ status: "ok", service: "supabase" }))

	// POST /api/v1/supabase/create  -- { table, data }
	.post("/create", async ({ supabaseService, body, set }) => {
		const { data, error } = await supabaseService.create(
			(body as any).table,
			(body as any).data,
		);
		if (error) {
			set.status = 400;
			return { success: false, message: error.message };
		}
		return { success: true, data };
	})

	// GET  /api/v1/supabase/read/:table
	.get("/read/:table", async ({ supabaseService, params }) => {
		const { data, error } = await supabaseService.read(params.table, undefined);
		if (error) return { success: false, message: error.message };
		return { success: true, data };
	})

	// PUT  /api/v1/supabase/update  -- { table, id, data }
	.put("/update", async ({ supabaseService, body, set }) => {
		const { data, error } = await supabaseService.update(
			(body as any).table,
			(body as any).id,
			(body as any).data,
		);
		if (error) {
			set.status = 400;
			return { success: false, message: error.message };
		}
		return { success: true, data };
	})

	// DELETE /api/v1/supabase/delete  -- { table, id }
	.delete("/delete", async ({ supabaseService, body, set }) => {
		const { data, error } = await supabaseService.delete(
			(body as any).table,
			(body as any).id,
		);
		if (error) {
			set.status = 400;
			return { success: false, message: error.message };
		}
		return { success: true, data };
	});

export { supabaseRoutes };
