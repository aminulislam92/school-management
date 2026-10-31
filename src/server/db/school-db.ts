import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import {
  CHILD_MODELS,
  modelKind,
  scopeWhere,
  TenantViolationError,
  type ModelName,
} from "./tenant-scope";

// Operations whose `where` is a normal filter: we AND the school condition in.
const FILTER_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "updateManyAndReturn",
  "deleteMany",
]);

// Operations whose `where` must identify one row: we add the school condition
// next to the unique key, so a row from another school is simply "not found".
const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);

const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

type Data = Record<string, unknown>;

function delegate(client: PrismaClient, model: ModelName) {
  const key = (model.charAt(0).toLowerCase() + model.slice(1)) as keyof PrismaClient;
  return client[key] as unknown as { count(args: unknown): Promise<number> };
}

/**
 * A Prisma client that can only see and change one school's rows.
 * Use it for everything inside a school; use the plain `db` only for
 * super-admin work and system jobs.
 *
 * What it does:
 * - reads, updates and deletes: adds the school condition to `where`
 * - creates: `schoolId` must be this school (it is filled in if missing);
 *   for child tables the parent row must belong to this school
 * - updates: `schoolId` can't be changed; a child's parent can't be moved to another school
 * - any table not listed in tenant-scope.ts: refused
 *
 * What it does not check (rules in CLAUDE.md):
 * - ids inside nested writes (`connect`, nested `create`) — validate foreign ids in the action
 * - raw SQL ($queryRaw / $executeRaw) — don't use raw SQL with school data
 */
export function forSchool(schoolId: number) {
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    throw new TenantViolationError(`invalid schoolId: ${schoolId}`);
  }

  async function checkCreateData(model: ModelName, data: Data) {
    const kind = modelKind(model);

    if (kind === "global") {
      throw new TenantViolationError(`${model} can't be created from a school`);
    }

    if (kind === "school") {
      if ("school" in data) {
        throw new TenantViolationError(`${model}: pass schoolId, not the "school" relation`);
      }
      if (data.schoolId === undefined) data.schoolId = schoolId;
      else if (data.schoolId !== schoolId) {
        throw new TenantViolationError(`${model}: schoolId ${String(data.schoolId)} is not this school`);
      }
      return;
    }

    const child = CHILD_MODELS[model]!;
    if (child.relation in data) {
      throw new TenantViolationError(`${model}: pass ${child.fk}, not the "${child.relation}" relation`);
    }
    await checkParent(model, data[child.fk]);
  }

  async function checkParent(model: ModelName, parentId: unknown) {
    const child = CHILD_MODELS[model]!;
    if (typeof parentId !== "number") {
      throw new TenantViolationError(`${model}: ${child.fk} is required`);
    }
    const found = await delegate(db, child.parent).count({
      where: { id: parentId, ...scopeWhere(child.parent, schoolId) },
    });
    if (found === 0) {
      throw new TenantViolationError(`${model}: ${child.parent} ${parentId} is not in this school`);
    }
  }

  async function checkUpdateData(model: ModelName, data: Data | undefined) {
    if (!data) return;
    const kind = modelKind(model);
    if (kind === "global" && model !== "School") {
      throw new TenantViolationError(`${model} can't be changed from a school`);
    }
    if ("schoolId" in data && data.schoolId !== schoolId) {
      throw new TenantViolationError(`${model}: schoolId can't be changed`);
    }
    if (model === "School" && ("id" in data || "code" in data || "status" in data)) {
      throw new TenantViolationError("School: id, code and status are changed by the super admin only");
    }
    if (kind === "child") {
      const child = CHILD_MODELS[model]!;
      if (child.relation in data) {
        throw new TenantViolationError(`${model}: change ${child.fk}, not the "${child.relation}" relation`);
      }
      if (child.fk in data) await checkParent(model, data[child.fk]);
    }
  }

  return db.$extends({
    name: "school-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const name = model as ModelName;
          if (modelKind(name) === null) {
            throw new TenantViolationError(
              `${model} is not classified in src/server/db/tenant-scope.ts`,
            );
          }

          const a = (args ?? {}) as Data;
          const scope = scopeWhere(name, schoolId);

          if (FILTER_OPS.has(operation)) {
            a.where = a.where ? { AND: [a.where, scope] } : scope;
          } else if (UNIQUE_OPS.has(operation)) {
            a.where = { ...(a.where as Data), ...scope };
          }

          if (CREATE_OPS.has(operation)) {
            const rows = Array.isArray(a.data) ? a.data : [a.data];
            for (const row of rows) await checkCreateData(name, row as Data);
          }

          if (operation === "upsert") {
            await checkCreateData(name, a.create as Data);
            await checkUpdateData(name, a.update as Data);
          } else if (["update", "updateMany", "updateManyAndReturn"].includes(operation)) {
            await checkUpdateData(name, a.data as Data);
          }

          return query(a as typeof args);
        },
      },
    },
  });
}

export type SchoolDb = ReturnType<typeof forSchool>;

// Re-exported so callers can recognise "not found in this school" errors.
export const isNotFoundError = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
