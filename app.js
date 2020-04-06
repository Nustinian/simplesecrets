require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const bcrypt = require ("bcrypt");
const saltRounds = 10;
 
mongoose.connect(
	"mongodb://localhost:27017/userdb",
	{
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: true
	}
);

const app = express();

const userSchema = new mongoose.Schema({
	username: {
		type: String,
		required: true,
		minlength: 4,
		maxlength: 32
	},
	password: {
		type: String,
		required: true,
	}
});

const User = mongoose.model("User", userSchema);

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.get("/", (_req, res) => {
	res.render("home");
});

app.route("/login")
	.get((_req, res) => {
		res.render("login");
	})
	.post((req, res) => {
		User.findOne(
			{username: req.body.username},
			(err, results) => {
				if (err) {
					console.log(err);
					res.send({error: err});
				} else if (results.length === 0) {
					res.send({message: "No user with that username exists."});
				} else {
					bcrypt.compare(req.body.password, results.password, (err, result) => {
						if (result) {
							res.render("secrets");
						} else {
							res.send({message: "Incorrect password."});
						}
					});
				}
			}
		);
	});

app.route("/register")
	.get((_req, res) => {
		res.render("register");
	})
	.post((req, res) => {
		User.exists(
			{username: req.body.username},
			(err, exists) => {
				if (err) {
					console.log(err);
					res.send({error: err});
				} else if (exists) {
					res.send({message: "User with that username already exists."});
				} else {
					bcrypt.hash(req.body.password, saltRounds, (err, hash) => {							
						const newUser = new User ({
							username: req.body.username,
							password: hash
						});
						newUser.save((err, results) => {
							if (err) {
								console.log(err);
								res.send({error: err});
							} else {
								console.log("New user created.")
								res.render("secrets");
							}
						});
					});
				}
			}
		);
	});

app.get("/logout", (_req, res) => {
	res.render("home");
});


let port = process.env.PORT;

if (port == null || port == "") {
	port = 3000;
}

app.listen(port, () => {
	console.log(`Server started on port ${port}.`);
});
