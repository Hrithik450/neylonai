import { relations } from "drizzle-orm/relations";
import { user, account, session, thread, threadMessages, djangoContentType, authPermission, authGroupPermissions, authGroup, authUserGroups, authUser, authUserUserPermissions, djangoAdminLog } from "./schema";

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	sessions: many(session),
	threads: many(thread),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const threadMessagesRelations = relations(threadMessages, ({one}) => ({
	thread: one(thread, {
		fields: [threadMessages.threadId],
		references: [thread.id]
	}),
}));

export const threadRelations = relations(thread, ({one, many}) => ({
	threadMessages: many(threadMessages),
	user: one(user, {
		fields: [thread.userId],
		references: [user.id]
	}),
}));

export const authPermissionRelations = relations(authPermission, ({one, many}) => ({
	djangoContentType: one(djangoContentType, {
		fields: [authPermission.contentTypeId],
		references: [djangoContentType.id]
	}),
	authGroupPermissions: many(authGroupPermissions),
	authUserUserPermissions: many(authUserUserPermissions),
}));

export const djangoContentTypeRelations = relations(djangoContentType, ({many}) => ({
	authPermissions: many(authPermission),
	djangoAdminLogs: many(djangoAdminLog),
}));

export const authGroupPermissionsRelations = relations(authGroupPermissions, ({one}) => ({
	authPermission: one(authPermission, {
		fields: [authGroupPermissions.permissionId],
		references: [authPermission.id]
	}),
	authGroup: one(authGroup, {
		fields: [authGroupPermissions.groupId],
		references: [authGroup.id]
	}),
}));

export const authGroupRelations = relations(authGroup, ({many}) => ({
	authGroupPermissions: many(authGroupPermissions),
	authUserGroups: many(authUserGroups),
}));

export const authUserGroupsRelations = relations(authUserGroups, ({one}) => ({
	authGroup: one(authGroup, {
		fields: [authUserGroups.groupId],
		references: [authGroup.id]
	}),
	authUser: one(authUser, {
		fields: [authUserGroups.userId],
		references: [authUser.id]
	}),
}));

export const authUserRelations = relations(authUser, ({many}) => ({
	authUserGroups: many(authUserGroups),
	authUserUserPermissions: many(authUserUserPermissions),
	djangoAdminLogs: many(djangoAdminLog),
}));

export const authUserUserPermissionsRelations = relations(authUserUserPermissions, ({one}) => ({
	authPermission: one(authPermission, {
		fields: [authUserUserPermissions.permissionId],
		references: [authPermission.id]
	}),
	authUser: one(authUser, {
		fields: [authUserUserPermissions.userId],
		references: [authUser.id]
	}),
}));

export const djangoAdminLogRelations = relations(djangoAdminLog, ({one}) => ({
	djangoContentType: one(djangoContentType, {
		fields: [djangoAdminLog.contentTypeId],
		references: [djangoContentType.id]
	}),
	authUser: one(authUser, {
		fields: [djangoAdminLog.userId],
		references: [authUser.id]
	}),
}));