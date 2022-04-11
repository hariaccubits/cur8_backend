
const mongoose = require('mongoose');
const Schema = mongoose.Schema;


let policySchema= new Schema({
    policyId:{
        type:String,
        required:true
    },
    script:{
        type:Object,
        required:true
    }

});

module.exports = mongoose.model('Policy',policySchema);