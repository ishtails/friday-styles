import yaml from "js-yaml";
import { config } from "@/config.ts";
import type { Idea, Objective } from "@/lib/db/schema.ts";
import { resolvePath } from "./path.ts";
import { getState, updateState } from "./state.ts";

export interface CleanupOptions {
	removeCompletedGoals?: boolean;
	removeArchivedGoals?: boolean;
	removePausedGoals?: boolean;
	goalAgeThreshold?: number; // days
	removeCompletedIdeas?: boolean;
	removeArchivedIdeas?: boolean;
	ideaAgeThreshold?: number; // days
	preset?: "aggressive" | "conservative" | "custom";
}

interface CleanupSummary {
	backupPath: string;
	changelogBackupPath: string;
	goalsRemoved: number;
	ideasRemoved: number;
}

function isOld(createdAt: number, thresholdDays: number): boolean {
	const ageDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
	return ageDays > thresholdDays;
}

function applyPreset(options: CleanupOptions): CleanupOptions {
	if (options.preset === "aggressive") {
		return {
			removeCompletedGoals: true,
			removeArchivedGoals: true,
			removePausedGoals: true,
			goalAgeThreshold: 90,
			removeCompletedIdeas: true,
			removeArchivedIdeas: true,
			ideaAgeThreshold: 180,
		};
	}
	// conservative (default)
	return {
		removeCompletedGoals: true,
		removeArchivedGoals: true,
		removePausedGoals: false,
		removeCompletedIdeas: true,
		removeArchivedIdeas: true,
	};
}

export async function cleanupState(
	options: CleanupOptions = {},
): Promise<CleanupSummary> {
	const state = await getState();
	const opts = options.preset ? applyPreset(options) : options;

	// Create backups
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupDir = resolvePath(config.backupsDir);
	await Bun.$`mkdir -p ${backupDir}`.quiet();
	const backupPath = `${backupDir}/${timestamp}-state.yaml`;
	await Bun.write(backupPath, yaml.dump(state, { indent: 2 }));

	const logFile = Bun.file(resolvePath(config.logFile));
	const changelogBackupPath = `${backupDir}/${timestamp}-changelog.txt`;
	if (await logFile.exists()) {
		const changelogContent = await logFile.text();
		await Bun.write(changelogBackupPath, changelogContent);
	}
	await Bun.write(logFile, "");

	// Filter goals
	const initialGoalCount = state.data.goals.length;
	const filteredGoals = state.data.goals.filter((goal: Objective) => {
		if (opts.removeCompletedGoals && goal.status === "completed") return false;
		if (opts.removeArchivedGoals && goal.status === "archived") return false;
		if (opts.removePausedGoals && goal.status === "paused") {
			if (opts.goalAgeThreshold) {
				return !isOld(goal.createdAt, opts.goalAgeThreshold);
			}
			return false;
		}
		if (opts.goalAgeThreshold && isOld(goal.createdAt, opts.goalAgeThreshold)) {
			return false;
		}
		return true;
	});

	// Filter ideas
	const initialIdeaCount = state.data.ideas.length;
	const filteredIdeas = state.data.ideas.filter((idea: Idea) => {
		if (opts.removeCompletedIdeas && idea.status === "archived") return false;
		if (opts.removeArchivedIdeas && idea.status === "archived") return false;
		if (opts.ideaAgeThreshold && isOld(idea.createdAt, opts.ideaAgeThreshold)) {
			return false;
		}
		return true;
	});

	await updateState({
		data: {
			...state.data,
			goals: filteredGoals,
			ideas: filteredIdeas,
		},
	});

	return {
		backupPath,
		changelogBackupPath,
		goalsRemoved: initialGoalCount - filteredGoals.length,
		ideasRemoved: initialIdeaCount - filteredIdeas.length,
	};
}
