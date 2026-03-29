export declare const linkTagsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "link_tags";
    schema: undefined;
    columns: {
        linkId: import("drizzle-orm/pg-core").PgColumn<{
            name: "link_id";
            tableName: "link_tags";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        tagId: import("drizzle-orm/pg-core").PgColumn<{
            name: "tag_id";
            tableName: "link_tags";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export type LinkTag = typeof linkTagsTable.$inferSelect;
//# sourceMappingURL=link_tags.d.ts.map