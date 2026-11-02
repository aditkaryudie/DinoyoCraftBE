"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_js_1 = __importDefault(require("../config/database.js"));
class AiSetting extends sequelize_1.Model {
}
AiSetting.init({
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    is_auto_reply_active: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    model_name: { type: sequelize_1.DataTypes.STRING, defaultValue: 'gemini-1.5-pro' }, // Sesuai dropdown UI Admin
    api_key: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    system_prompt: { type: sequelize_1.DataTypes.TEXT, allowNull: true }
}, {
    sequelize: database_js_1.default,
    tableName: 'ai_settings',
    timestamps: false
});
exports.default = AiSetting;
//# sourceMappingURL=AiSetting.js.map