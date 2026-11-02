import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class AiSetting extends Model {
  declare id: number;
  declare is_auto_reply_active: boolean;
  declare model_name: string;
  declare api_key: string;
  declare system_prompt: string;
}

AiSetting.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  is_auto_reply_active: { type: DataTypes.BOOLEAN, defaultValue: false },
  model_name: { type: DataTypes.STRING, defaultValue: 'gemini-1.5-pro' }, // Sesuai dropdown UI Admin
  api_key: { type: DataTypes.STRING, allowNull: true },
  system_prompt: { type: DataTypes.TEXT, allowNull: true }
}, {
  sequelize,
  tableName: 'ai_settings',
  timestamps: false
});

export default AiSetting;

