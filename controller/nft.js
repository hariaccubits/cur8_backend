const nftController={};
const cardano = require('../services/cardano');
require('dotenv').config()
const Policy=require('../models/policy');

nftController.post=async(req,res)=>{
    const wallet= cardano.wallet("ADA");
    let utxo= wallet.balance().utxo;
    console.log("UTXO=>",utxo);
    
    let {hash,assetName,assetNum,description,rType}=req.body;
    if(hash==undefined||assetName==undefined||rType==undefined||description==undefined,assetNum==undefined){
        return(res.json({"message":"Please provide all the required fields"}));

    }
    if(utxo.length==0){
        return res.json({"message":"Make sure to send Ada if already sended pls wait for a few minutes"});
    }
   
    let ipfsLink="ipfs://"+hash;
    // 2. Define mint script
    console.log("IPFS=>",ipfsLink);
    let mintScript=""
    let POLICY_ID="";
    if(req.body.policy==undefined){
        if(req.body.days==undefined){
            return res.json({"message":"Please provide either policy or days"});
        }
        //convert days to seconds as 1 slot= 1 second
        let seconds=req.body.days*24*60*60;
        //query cardano for current slot
        let currentSlot=cardano.queryTip().slot;

        //calculate slot to expire
        let slot=currentSlot+seconds;

         mintScript = {
            "type": "all",
            "scripts":
            [
              {
                "type": "before",
                "slot": slot,
              },
              {
                "type": "sig",
                "keyHash": cardano.addressKeyHash(wallet.name)
              }
            ]
        }
        POLICY_ID= cardano.transactionPolicyid(mintScript)
        let policy= new Policy({
            policyId:POLICY_ID,
            script:mintScript
        });

        try{
            let savedPolicy=policy.save();
            
        }
        catch(err){
            console.log(err);
        }


    }
    else{
        POLICY_ID=req.body.policy;
        try{
        let getPolicy=await Policy.findOne({policyId:POLICY_ID});
        mintScript=getPolicy.script;
        }catch(err){
            return res.json({"message":"Invalid policy id"});    
        }
        
        
    }


    
    
     
    // 3. Create POLICY_ID
   
    
    
     
     
    //4.asset name Hex
    const ASSET_NAME_HEX = assetName.split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    
     // 5. Create ASSET_ID which os sum of ASSET_NAME_HEX and POLICY_ID
    const ASSET_ID = POLICY_ID + "." + ASSET_NAME_HEX
    
     // 6. Define metadata

    const metadata = {
         721: {
             [POLICY_ID]: {
                 [assetName]: {
                     name: assetName,
                     image: ipfsLink,
                     description: description,
                     type: rType,
               
                 }
             }
         }
     }

   
     console.log("ASSET_NUM=>",assetNum);
     let obj={lovelace: wallet.balance().value.lovelace}
     let notContain=0;
     const keys= Object.keys(wallet.balance().value).forEach(key=>{
        if(key!=ASSET_ID&&key!="lovelace"&& key!="undefined"){
            
            obj[key]=wallet.balance().value[key];
        }
        else if(key==ASSET_ID){
            
            obj[key]=wallet.balance().value[key]+assetNum;
            console.log("OBJ[KEY]=>",obj[key]);
            notContain=1;
           
            
        }
     });
    
        if(notContain==0){
            obj[ASSET_ID]=assetNum;
        }
     // 7. Define transaction
     
     const tx = {
         txIn: wallet.balance().utxo,
         txOut: [
             {
                 address: wallet.paymentAddr,
                 value: obj
             }
         ],
         mint: [
             { action: "mint", quantity: assetNum, asset: ASSET_ID, script: mintScript },
         ],
         metadata,
         witnessCount: 2
     }
     


    

     // 8. Build transaction

     const buildTransaction = (tx) => {

         const raw = cardano.transactionBuildRaw(tx)
         const fee = cardano.transactionCalculateMinFee({
             ...tx,
             txBody: raw
         })

         tx.txOut[0].value.lovelace -= fee

         return cardano.transactionBuildRaw({ ...tx, fee })
     }

     console.log(tx.txOut);
     const raw = buildTransaction(tx)

     // 9. Sign transaction

     const signTransaction = (wallet, tx) => {

         return cardano.transactionSign({
             signingKeys: [wallet.payment.skey, wallet.payment.skey ],
             txBody: tx
         })
     }

     const signed = signTransaction(wallet, raw)
     console.log("SIGNED=>",signed);
     // 10. Submit transaction

     const txHash = cardano.transactionSubmit(signed)

     res.json({"message":"Transaction Submitted","txHash":txHash});

}

nftController.send=async(req,res)=>{
    const sender= cardano.wallet("ADA");
    let receiverAddress=req.body.receiverAddress;
    let asset= req.body.assetId;
    let notContain=0;
    let utxo= sender.balance();
    let amount= req.body.amount;
    

    let obj={
        lovelace: sender.balance().value.lovelace - cardano.toLovelace(1.6),
    };
    

    const keys= Object.keys(utxo.value).forEach(key=>{
        if(key!=asset&&key!="lovelace"&& key!="undefined"){
            
            obj[key]=utxo.value[key];
        }
        else if(key==asset){
            if(utxo.value[key]>=amount){
                obj[key]=utxo.value[key]-amount;
                notContain=1;
            }
            else{
                return res.json({"message":"Insufficient Asset balance"});
            }
            
        }
        
    });

    if(notContain==0){
        return res.json({"message":"Asset not found try getting balance again"});
    }
    console.log("OBJ=>",obj);
    
    
    const txInfo = {
        txIn: cardano.queryUtxo(sender.paymentAddr),
        txOut: [
          {
            address: sender.paymentAddr,
            value: obj,
          },
          {
            address: receiverAddress,

            value: {
              lovelace: cardano.toLovelace(1.6),
              [asset]: amount,
            },
          },
        ],
      };


    console.log("TXINFO=>",txInfo);
    

    const raw = cardano.transactionBuildRaw(txInfo);

    const fee = cardano.transactionCalculateMinFee({
        ...txInfo,
        txBody: raw,
        witnessCount: 1,
    });

    //pay the fee by subtracting it from the sender utxo
    txInfo.txOut[0].value.lovelace -= fee;

    //create final transaction
    const tx = cardano.transactionBuildRaw({ ...txInfo, fee });

    //sign the transaction
    const txSigned = cardano.transactionSign({
        txBody: tx,
        signingKeys: [sender.payment.skey],
    });

    //submit transaction
    const txHash = cardano.transactionSubmit(txSigned);
    res.json({"message":"Transfer Transaction Submitted","txHash":txHash});


}

nftController.test= async(req,res)=>{
    res.json(process.env);
}


module.exports = nftController;