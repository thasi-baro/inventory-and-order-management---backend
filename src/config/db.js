import mongooes from 'mongoose';

//Func to connect to mongoes db using mongooes
export const connectDB = async () => {
    try {
        await mongooes.connect(process.env.MONGOES_CONN_STR);
        console.log('Connect to db successfully');
    } catch (error) {
        console.error('Error when connect to db:', error);
        process.exit(1); //có lỗi thì exit chương trình
    }
}   