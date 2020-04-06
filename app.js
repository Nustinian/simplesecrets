require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
	secret: "thisisthesecrethati'mgoingtobeusingformysession,iguess.",
	resave: false,
	saveUninitialized: false		
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(
	"mongodb://localhost:27017/userdb",
	{
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: true
	}
);

const userSchema = new mongoose.Schema({
	username: String,
	password: String,
	googleId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

const secretSchema = new mongoose.Schema({
	secret: String
});

const Secret = mongoose.model("Secret", secretSchema);

passport.use(User.createStrategy());

passport.use(new GoogleStrategy({
	clientID: process.env.GOOGLE_CLIENT_ID,
	clientSecret: process.env.GOOGLE_CLIENT_SECRET,
	callbackURL: `http://${process.env.EC2_PUBLIC_DNS}:3000/auth/google/secrets`,
	userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
	},
	function(accessToken, refreshToken, profile, cb) {
		console.log(profile);
		User.findOrCreate({googleId: profile.id}, (err, user) => {
			return cb(err, user);
		});
	}
));

passport.serializeUser(function(user, done) {
  	done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
	    done(err, user);
	});
});

app.get("/", (_req, res) => {
	res.render("home");
});

app.get("/auth/google",
	passport.authenticate("google", {scope: ["profile"]})	
);

app.get("/auth/google/secrets",
	passport.authenticate("google", {failureRedirect: "/login"}),
	(req, res) => {
		res.redirect("/submit");
	}
);


app.get("/secrets", (req, res) => {
	if (req.isAuthenticated()) {
		Secret.find({}, {_id: 0, __v: 0}, (err, results) => {
			if (err) {
				console.log(err);
			} else {
				res.render("secrets", {allSecrets: results});
			}
		});
	} else {
		res.redirect("/login");
	}
});

app.route("/login")
	.get((_req, res) => {
		res.render("login");
	})
	.post((req, res) => {
	    const user = new User({
			username: req.body.username,
			password: req.body.password
		});

		req.login(user, (err) => {
			if (err) {
				console.log(err);
			} else {
				passport.authenticate("local")(req, res, function() {
					res.redirect("/secrets");
				});
			}
		});
	});

app.route("/register")
	.get((_req, res) => {
		res.render("register");
	})
	.post((req, res) => {
		User.register(
			{username: req.body.username},
			req.body.password,
			(err, user) => {
				if (err) {
					console.log(err);
					res.redirect("/register");
				} else {
					passport.authenticate("local")(req, res, () => {
						res.redirect("/secrets");
					})
				}
			}
		);
	});

app.get("/logout", (req, res) => {
	req.logout();
	res.redirect("/");
});

app.get("/submit", (req, res) => {
	if (req.isAuthenticated()) {
		res.render("submit");
	} else {
		res.redirect("/login");
	}
});

app.post("/submit", (req, res) => {
	newSecret = new Secret({
		secret: req.body.secret
	});
    newSecret.save((err) => {
		if (err) {
			console.log(err);
			res.send({error: err});
		} else {
			console.log("Success!");
			res.redirect("/secrets");
		}
	});
});


let port = process.env.PORT;

if (port == null || port == "") {
	port = 3000;
}

app.listen(port, () => {
	console.log(`Server started on port ${port}.`);
});
