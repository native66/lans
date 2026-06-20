import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(), 
  address: text("address").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  ownerAddress: text("owner_address").notNull(),
  name: text("name").notNull(),
  status: text("status").default("Active").notNull(),
  budget: text("budget"),
  spent: text("spent").default("0"),
  profit: text("profit").default("0"),
  strategy: text("strategy"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const policies = pgTable("policies", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  maxBudget: integer("max_budget"),
  allowedProtocols: text("allowed_protocols"),
  createdAt: timestamp("created_at").defaultNow(),
});
