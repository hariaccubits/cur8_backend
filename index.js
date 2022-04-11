const app = require('./app');
require('dotenv').config()
const PORT = process.env.PORT || 3000;
const mongoose= require('mongoose');
mongoose.connect(process.env.DB_URI).then(()=>{
    app.listen(PORT,(err)=>{
        if(err){
            res.send(err);
        }
        console .log("Server Running on Port ",PORT)
    });
}).catch(err=>{console.log(err)});