const express = require('express');
const { createUser, loginUser } = require('../services/user.services');
const authenticateAdmin = require('../libraries/auth/adminAuth');

const router = express.Router();

router.post('/',authenticateAdmin, async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/register',async(req,res)=>{
  try {
    const {name,email,password} = req.body;
    const user = await createUser({name,email,password,role:'CLIENT'});
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
})

router.post('/login', async (req, res) => {
  try {
    const user = await loginUser(req.body.email, req.body.password);
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
