const router = require('express').Router();
const nftController= require('../controller/nft');

router.post('/mint',nftController.post);
router.post('/send',nftController.send);
router.get('/test',nftController.test);
module.exports = router;