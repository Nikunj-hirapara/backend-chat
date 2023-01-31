const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002'
];

const corsOptions = {
    // origin:true,
    origin: (origin:any, callback:Function) => {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE','PATCH'],
    credentials: true,
    optionsSuccessStatus: 200
}

export default corsOptions;