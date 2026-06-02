import mongoose from "mongoose";

//Schema quản lí token
const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref :'User',
        required: true,
        index: true
    },
    refreshToken:{
        type:String,
        required:true,
        unique:true,
    },
    expiresAt:{//Lưu thời gian hết hạn
        type:Date,
        required:true,

    }
},
{
    timestamps: true
});

//Tự động xóa khi hết hạn
sessionSchema.index({expiresAt:1},{expireAfterSeconds:0});

export default mongoose.model('Session',sessionSchema);