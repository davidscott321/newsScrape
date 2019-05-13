var express = require("express");
// var method = require("method-override");
var body = require("body-parser");
var exphbs = require("express-handlebars");
var mongoose = require("mongoose");
// var logger = require("morgan");
var cheerio = require("cheerio");
// var request = require("request");
var axios = require("axios");

var Note = require("./models/Note");
var Article = require("./models/Article");
var databaseURL = 'mongodb://localhost/newsScrape';

if (process.env.MONGODB_URI) {
	mongoose.connect(process.env.MONGODB_URI);
}
else {
	mongoose.connect(databaseURL);
};

mongoose.Promise = Promise;
var db = mongoose.connection;

db.on("error", function(error) {
	console.log("Mongoose Error: ", error);
});
db.once("open", function() {
	console.log("Mongoose connection successful.");
});

var app = express();
var port = process.env.PORT || 3000;

// app.use(logger("dev"));
app.use(express.static("public"));
app.use(body.urlencoded({extended: false}));
// app.use(method("_method"));
app.engine("handlebars", exphbs({defaultLayout: "main"}));
app.set("view engine", "handlebars");

app.listen(port, function() {
	console.log("Listening on port " + port);
})

app.get("/", function(req, res) {
	Article.find({}, null, {sort: {created: -1}}, function(err, data) {
		// if(data.length === 0) {
		// 	res.render("placeholder", {message: "There's nothing scraped yet. Please click \"Scrape For Nsewest Articles\" for fresh and delicious news."});
		// }
		// else{
			res.render("index", {articles: data});
		// }
	});
});

// app.post("/scrape", function (req, res) {

// }

app.get("/scrape", function (req, res) {
	// First, we grab the body of the html with axios
	axios.get("https://www.cracked.com/").then(function (response) {
			// Then, we load that into cheerio and save it to $ for a shorthand selector
			var $ = cheerio.load(response.data);
			var scrapedResults = [];
			var newArticles = [];

			// Now, we grab every h2 within an article tag, and do the following:
			$("div#content-list div.content-item div.d-flex").each(function (i, element) {
				var result = {};
				var title = $(this).children('div.content-cards-info').children('h3').children('a').text();
				var link = $(this).children('div.content-cards-info').children('h3').children('a').attr('href');
				var description = $(this).children('div.content-cards-info').children('p').text();
				var picLink = $(this).children('a').attr('data-original');

				result.title = title;
				result.link = link;
				result.description = description;
				result.picLink = picLink;

				scrapedResults.push(result);
			});
					
			// for(var i=0;i<scrapedResults.length;i++)
			// {
			// 	console.log(scrapedResults[i]);
			// }

			Article.find({}, null, {sort: {created: -1}}, function(err, data) {
				if(data.length>0)
				{
					for(var i=0;i<scrapedResults.length;i++)
					{
						var matched = false;

						for(var j=0;j<data.length;j++)
						{
							if(data[j].title===scrapedResults[i].title)
							{
								matched = true;
							}
						}

						if(!matched)
						{
							newArticles.push(scrapedResults[i]);
						}
					}
				}
				else
				{
					newArticles = scrapedResults;
					console.log(newArticles.length);
				}

				for(var i=0;i<newArticles.length;i++)
				{
					console.log("HIT");
					console.log("+++++++++++++++++++++++");
					Article.create(newArticles[i])
					.then(function (dbArticle) {
							console.log(dbArticle);
					})
					.catch(function (err) {
							return res.json(err);
					});
				}
			});
				
			
				// console.log(data);
				
				// if(data.length === 0) {
				// 	res.render("placeholder", {message: "There's nothing scraped yet. Please click \"Scrape For Nsewest Articles\" for fresh and delicious news."});
				// }
				// else{
					// res.render("index", {articles: data});
				// }
			// console.log("complete");

			
	});

	res.send("scrape completed.");
	// res.redirect("/");
});

app.get("/saved", function(req, res) {
	Article.find({issaved: true}, null, {sort: {created: -1}}, function(err, data) {
		if(data.length === 0) {
			res.render("placeholder", {message: "You have not saved any articles yet. Try to save some delicious news by simply clicking \"Save Article\"!"});
		}
		else {
			res.render("saved", {saved: data});
		}
	});
});

app.get("/:id", function(req, res) {
	Article.findById(req.params.id, function(err, data) {
		res.json(data);
	})
})

app.post("/search", function(req, res) {
	console.log(req.body.search);
	Article.find({$text: {$search: req.body.search, $caseSensitive: false}}, null, {sort: {created: -1}}, function(err, data) {
		console.log(data);
		if (data.length === 0) {
			res.render("placeholder", {message: "Nothing has been found. Please try other keywords."});
		}
		else {
			res.render("search", {search: data})
		}
	})
});

app.post("/save/:id", function(req, res) {
	Article.findById(req.params.id, function(err, data) {
		if (data.issaved) {
			Article.findByIdAndUpdate(req.params.id, {$set: {issaved: false, status: "Save Article"}}, {new: true}, function(err, data) {
				res.redirect("/");
			});
		}
		else {
			Article.findByIdAndUpdate(req.params.id, {$set: {issaved: true, status: "Saved"}}, {new: true}, function(err, data) {
				res.redirect("/saved");
			});
		}
	});
});

app.post("/note/:id", function(req, res) {
	var note = new Note(req.body);
	note.save(function(err, doc) {
		if (err) throw err;
		Article.findByIdAndUpdate(req.params.id, {$set: {"note": doc._id}}, {new: true}, function(err, newdoc) {
			if (err) throw err;
			else {
				res.send(newdoc);
			}
		});
	});
});

app.get("/note/:id", function(req, res) {
	var id = req.params.id;
	Article.findById(id).populate("note").exec(function(err, data) {
		res.send(data.note);
	})
})