import { Model } from 'sequelize';
declare class AiSetting extends Model {
    id: number;
    is_auto_reply_active: boolean;
    model_name: string;
    api_key: string;
    system_prompt: string;
}
export default AiSetting;
//# sourceMappingURL=AiSetting.d.ts.map