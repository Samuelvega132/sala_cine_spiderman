import { DELETE as deleteSession, GET as getSession, POST as postSession } from "@/lib/controllers/session-controller";

export const dynamic = "force-dynamic";
export const GET = getSession;
export const POST = postSession;
export const DELETE = deleteSession;
