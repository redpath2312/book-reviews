import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";
import lodash from "lodash";

const app = express();
const port = 3000;
const API_URL = "https://covers.openlibrary.org/b/";
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

var _ = lodash;

const db = new pg.Client({
	user: "postgres",
	host: "localhost",
	database: "bookreviews",
	password: "sql123",
	port: 5432,
});
db.connect();

let requestedBook;
let requestedBookName;
let currentAlertMessage;

app.get("/", async (req, res) => {
	let books = [];
	const result = await db.query("SELECT * FROM books ORDER BY id ASC");
	result.rows.forEach((book) => {
		books.push(book);

		// We are using public api to retrieve an image of the book cover with the isbn number, and then adding this information to an array, then rendering all the book info.
		let bookImgSource = API_URL + "isbn/" + book.isbn + "-M.jpg";
		book.img_source = bookImgSource;
		});
	res.render("index.ejs", {
		booksEJS: books,
		alertMessageEJS: currentAlertMessage,
		});
	currentAlertMessage = "";
});

app.get("/book/:bookName", async (req, res) => {
	let books = [];
	const result = await db.query("SELECT * FROM books ORDER BY id ASC");
	result.rows.forEach((book) => {
		books.push(book);
	});
	requestedBookName = _.lowerCase(req.params.bookName);

	// Loops through all the books and if the book we are requesting (either via url params or clicking specific book)
	// If it matches a stored bookname (the short name) it will render the book information

	for (let i = 0; i < books.length; i++) {
		const storedBookName = _.lowerCase(books[i].short_name);
		if (storedBookName === requestedBookName) {
			let bookImgSource = `${API_URL}isbn/${books[i].isbn}-M.jpg`;
			books[i].img_source = bookImgSource;
			requestedBook = books[i];
			res.render("book.ejs", { bookEJS: books[i], alertMessageEJS: currentAlertMessage});
			break;
		} else if (i == books.length - 1 && storedBookName != requestedBookName) {
			console.log("No match");
			currentAlertMessage = "Error: Book could not be found!";
			res.redirect("/");
		}
	}
});

app.get("/new", (req, res) => {
	res.render("new.ejs", { alertMessageEJS: currentAlertMessage });
	currentAlertMessage = "";
});

app.get("/edit", (req, res) => {
	const formattedDate = requestedBook.date_read.toISOString().substring(0, 10);

	requestedBook["date_read"] = formattedDate;

	res.render("edit.ejs", { bookEJSEdit: {...requestedBook, date_read: formattedDate } });	
})

app.post("/edit", async (req, res) => {
	const editedBook = {
		editedTitle: req.body.title,
		editedAuthor: req.body.author,
		editedRating: req.body.rating,
		editedDate: req.body.date,
		editedISBN: req.body.isbn,
		editedSummary: req.body.summary,
		editedShortName: req.body.shortname,
		editedDescription: req.body.description,
	};
	//console.log(editedBook);

	try {
		await db.query(
			"UPDATE books SET title = $1, author = $2, rating = $3, date_read = $4, isbn = $5, summary = $6, description = $7, short_name = $8 WHERE id=$9",
			[
				editedBook.editedTitle,
				editedBook.editedAuthor,
				editedBook.editedRating,
				editedBook.editedDate,
				editedBook.editedISBN,
				editedBook.editedSummary,
				editedBook.editedDescription,
				editedBook.editedShortName,
				requestedBook.id,
			]
		);
		currentAlertMessage = "Alert: Updated";
	} catch (err) {
		console.log(err);
		currentAlertMessage = err;
	}

	res.redirect("/book/" + requestedBookName);

	// Example db query
	// db query UPDATE books
	// SET  COL1 = VALUE1, COL2 = VALUE2
	// WHERE BOOK ID = REQUESTEDBOOK.ID
});
app.post("/new", async (req, res) => {
	const newBook = {
		title: req.body.title,
		author: req.body.author,
		rating: req.body.rating,
		date_read: req.body.date,
		isbn: req.body.isbn,
		summary: req.body.summary,
		description: req.body.description,
		short_name: req.body.shortname,
	};
	console.log(newBook);

	// //Now have the form data, we can see if there are any properties missing and making an empty props array for all the missing fields to help inform the user.

	// let emptyProps = [];	

	// for (const prop in newBook) {
	// 	if (newBook[prop] === "") {
	// 		emptyProps.push(prop);
	// 	}
	// }

	// // We can craft a message to the user by referring to the empty props, and if there are any empty props the database won't be called.
	// let emptyPropsMessage = "";
	// if (emptyProps.length > 0) {
	// 	for (let newProp in emptyProps) {
	// 		// console.log(emptyProps[newProp]);
	// 		emptyPropsMessage += emptyProps[newProp] + ", ";
	// 	}
	// 	emptyPropsMessage +="is invalid/empty. Please check these fields and try submitting the information again.";
	// 	console.log(emptyPropsMessage);
	// 	currentAlertMessage = "Error: " + emptyPropsMessage;
	// 	res.render("new.ejs", {
	// 		alertMessageEJS: currentAlertMessage,
	// 		newBookEJS: newBook,
	// 	});
	// 	currentAlertMessage = "";
	// }

	// else 

	try {
		await db.query(
			"INSERT INTO books (title, author, rating, date_read, isbn, summary, description, short_name) VALUES ($1, $2 , $3, $4, $5, $6, $7, $8)",
			[
				newBook.title,
				newBook.author,
				newBook.rating,
				newBook.date_read,
				newBook.isbn,
				newBook.summary,
				newBook.description,
				newBook.short_name,
			]
		);
		currentAlertMessage = `Alert: ${newBook.title} has been added.`;
		res.redirect("/");
	} catch (err) {
		console.log(err);
		currentAlertMessage = err;
	}
});

app.get("/delete", async (req, res) => {
	console.log(
		"This would delete " +
			requestedBookName +
			" (" +
			requestedBook.title +
			")" +
			" and is 'id' of " +
			requestedBook.id
	);

	try {
		await db.query("DELETE from books WHERE id = $1", [requestedBook.id]);
	} catch (err) {
		console.log(err);
		currentAlertMessage = err;
	}
	currentAlertMessage = `Alert: ${requestedBook.title} has been deleted.`;
	requestedBook = "";
	requestedBookName = "";
	res.redirect("/");
});

app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
