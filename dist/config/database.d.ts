import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';
export declare const pool: mysql.Pool;
export declare const sequelize: Sequelize;
export declare const testConnection: () => Promise<void>;
declare const _default: mysql.Pool & Sequelize;
export default _default;
//# sourceMappingURL=database.d.ts.map