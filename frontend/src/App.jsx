import { useEffect, useMemo, useState } from "react";

const blankRegisterForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const blankLoginForm = {
  email: "",
  password: "",
};

const blankBookForm = {
  title: "",
  author: "",
  status: "want to read",
  rating: "",
};

const statusLabels = {
  "want to read": "Want to read",
  reading: "Reading",
  finished: "Finished",
};

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authView, setAuthView] = useState("login");
  const [user, setUser] = useState(null);
  const [books, setBooks] = useState([]);
  const [message, setMessage] = useState(null);
  const [registerForm, setRegisterForm] = useState(blankRegisterForm);
  const [loginForm, setLoginForm] = useState(blankLoginForm);
  const [bookForm, setBookForm] = useState(blankBookForm);
  const [editForm, setEditForm] = useState(blankBookForm);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyBookId, setBusyBookId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  function showMessage(text, type = "success") {
    setMessage({ text, type });
  }

  function clearSession() {
    setUser(null);
    setBooks([]);
    setEditingId(null);
    setDeleteId(null);
  }

  function handleError(error, fallbackText) {
    if (error.status === 401) {
      clearSession();
      setAuthView("login");
      showMessage("Login again to continue", "error");
      return;
    }

    showMessage(error.message || fallbackText, "error");
  }

  async function loadBooks() {
    const savedBooks = await apiRequest("/api/books");
    setBooks(savedBooks);
  }

  useEffect(() => {
    async function start() {
      try {
        const account = await apiRequest("/api/auth/me");
        setUser(account.user);
        await loadBooks();
      } catch (error) {
        if (error.status !== 401) {
          showMessage(error.message || "Could not load your account", "error");
        }
      } finally {
        setCheckingSession(false);
      }
    }

    start();
  }, []);

  const visibleBooks = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return books.filter((book) => {
      const matchesSearch =
        book.title.toLowerCase().includes(searchText) ||
        book.author.toLowerCase().includes(searchText);

      if (!matchesSearch) return false;
      if (filter === "all") return true;

      return book.status === filter;
    });
  }, [books, search, filter]);

  const counts = useMemo(() => {
    return books.reduce(
      (total, book) => {
        total.all += 1;
        total[book.status] += 1;
        return total;
      },
      {
        all: 0,
        "want to read": 0,
        reading: 0,
        finished: 0,
      }
    );
  }, [books]);

  function validateRegisterForm() {
    const name = registerForm.name.trim();
    const email = registerForm.email.trim();

    if (!name || !email || !registerForm.password || !registerForm.confirmPassword) {
      return "Fill all fields";
    }

    if (name.length < 2 || name.length > 40) {
      return "Name must be 2 to 40 characters";
    }

    if (!email.includes("@")) {
      return "Enter a valid email";
    }

    if (registerForm.password.length < 6) {
      return "Password must be at least 6 characters";
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      return "Passwords do not match";
    }

    return "";
  }

  function validateBookForm(form) {
    if (!form.title.trim()) return "Title is required";
    if (!form.author.trim()) return "Author is required";
    if (form.title.trim().length > 120) return "Title is too long";
    if (form.author.trim().length > 80) return "Author name is too long";

    if (form.rating !== "") {
      const rating = Number(form.rating);

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return "Rating must be from 1 to 5";
      }
    }

    return "";
  }

  async function registerUser(event) {
    event.preventDefault();

    const formError = validateRegisterForm();

    if (formError) {
      showMessage(formError, "error");
      return;
    }

    try {
      setBusy(true);
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(registerForm),
      });

      showMessage(data.message);
      setLoginForm({ email: registerForm.email, password: "" });
      setRegisterForm(blankRegisterForm);
      setAuthView("login");
    } catch (error) {
      handleError(error, "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  async function loginUser(event) {
    event.preventDefault();

    if (!loginForm.email.trim() || !loginForm.password) {
      showMessage("Enter email and password", "error");
      return;
    }

    try {
      setBusy(true);
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });

      setUser(data.user);
      setLoginForm(blankLoginForm);
      await loadBooks();
      showMessage(data.message);
    } catch (error) {
      handleError(error, "Could not login");
    } finally {
      setBusy(false);
    }
  }

  async function logoutUser() {
    try {
      const data = await apiRequest("/api/auth/logout", {
        method: "POST",
      });

      clearSession();
      setAuthView("login");
      showMessage(data.message);
    } catch (error) {
      handleError(error, "Could not logout");
    }
  }

  async function addBook(event) {
    event.preventDefault();

    const formError = validateBookForm(bookForm);

    if (formError) {
      showMessage(formError, "error");
      return;
    }

    try {
      setBusy(true);
      const data = await apiRequest("/api/books", {
        method: "POST",
        body: JSON.stringify(bookForm),
      });

      setBooks((currentBooks) => [data.book, ...currentBooks]);
      setBookForm(blankBookForm);
      showMessage(data.message);
    } catch (error) {
      handleError(error, "Could not add book");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(book) {
    setEditingId(book._id);
    setDeleteId(null);
    setEditForm({
      title: book.title,
      author: book.author,
      status: book.status,
      rating: book.rating || "",
    });
  }

  async function saveBook(bookId) {
    const formError = validateBookForm(editForm);

    if (formError) {
      showMessage(formError, "error");
      return;
    }

    try {
      setBusyBookId(bookId);
      const data = await apiRequest("/api/books/" + bookId, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });

      setBooks((currentBooks) =>
        currentBooks.map((book) => (book._id === bookId ? data.book : book))
      );
      setEditingId(null);
      showMessage(data.message);
    } catch (error) {
      handleError(error, "Could not save book");
    } finally {
      setBusyBookId(null);
    }
  }

  async function removeBook(bookId) {
    if (deleteId !== bookId) {
      setDeleteId(bookId);
      return;
    }

    try {
      setBusyBookId(bookId);
      const data = await apiRequest("/api/books/" + bookId, {
        method: "DELETE",
      });

      setBooks((currentBooks) =>
        currentBooks.filter((book) => book._id !== data.deletedId)
      );
      setDeleteId(null);
      showMessage(data.message);
    } catch (error) {
      handleError(error, "Could not delete book");
    } finally {
      setBusyBookId(null);
    }
  }

  async function changeStatus(book, status) {
    try {
      setBusyBookId(book._id);
      const data = await apiRequest("/api/books/" + book._id, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      setBooks((currentBooks) =>
        currentBooks.map((item) => (item._id === book._id ? data.book : item))
      );
      showMessage("Status updated");
    } catch (error) {
      handleError(error, "Could not update status");
    } finally {
      setBusyBookId(null);
    }
  }

  if (checkingSession) {
    return (
      <main className="page">
        <section className="loading-box">
          <p>Book Shelf</p>
          <h1>Opening your library</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      {!user ? (
        <section className="auth-page">
          <div className="auth-text">
            <p className="small-title">MERN CRUD</p>
            <h1>Book Shelf</h1>
            <p>
              Register, login, and keep a private list of books with create,
              read, update, and delete actions.
            </p>
          </div>

          <div className="auth-box">
            <div className="switcher" aria-label="Authentication view">
              <button
                type="button"
                className={authView === "login" ? "selected" : ""}
                onClick={() => setAuthView("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={authView === "register" ? "selected" : ""}
                onClick={() => setAuthView("register")}
              >
                Register
              </button>
            </div>

            {authView === "register" ? (
              <form className="form" onSubmit={registerUser}>
                <div>
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    value={registerForm.name}
                    onChange={(event) =>
                      setRegisterForm({ ...registerForm, name: event.target.value })
                    }
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="registerEmail">Email</label>
                  <input
                    id="registerEmail"
                    type="email"
                    value={registerForm.email}
                    onChange={(event) =>
                      setRegisterForm({ ...registerForm, email: event.target.value })
                    }
                    autoComplete="email"
                  />
                </div>
                <div className="two-fields">
                  <div>
                    <label htmlFor="registerPassword">Password</label>
                    <input
                      id="registerPassword"
                      type="password"
                      value={registerForm.password}
                      onChange={(event) =>
                        setRegisterForm({
                          ...registerForm,
                          password: event.target.value,
                        })
                      }
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword">Confirm</label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={registerForm.confirmPassword}
                      onChange={(event) =>
                        setRegisterForm({
                          ...registerForm,
                          confirmPassword: event.target.value,
                        })
                      }
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <button className="primary-button" disabled={busy}>
                  {busy ? "Creating" : "Create account"}
                </button>
              </form>
            ) : (
              <form className="form" onSubmit={loginUser}>
                <div>
                  <label htmlFor="loginEmail">Email</label>
                  <input
                    id="loginEmail"
                    type="email"
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm({ ...loginForm, email: event.target.value })
                    }
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="loginPassword">Password</label>
                  <input
                    id="loginPassword"
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm({ ...loginForm, password: event.target.value })
                    }
                    autoComplete="current-password"
                  />
                </div>
                <button className="primary-button" disabled={busy}>
                  {busy ? "Logging in" : "Login"}
                </button>
              </form>
            )}
          </div>
        </section>
      ) : (
        <section className="dashboard">
          <header className="topbar">
            <div>
              <p className="small-title">Book Shelf</p>
              <h1>Your books</h1>
            </div>
            <div className="account">
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <button className="text-button" onClick={logoutUser} type="button">
                Logout
              </button>
            </div>
          </header>

          <div className="dashboard-grid">
            <aside className="panel">
              <form className="form" onSubmit={addBook}>
                <div>
                  <label htmlFor="title">Book title</label>
                  <input
                    id="title"
                    value={bookForm.title}
                    onChange={(event) =>
                      setBookForm({ ...bookForm, title: event.target.value })
                    }
                    maxLength="120"
                  />
                </div>
                <div>
                  <label htmlFor="author">Author</label>
                  <input
                    id="author"
                    value={bookForm.author}
                    onChange={(event) =>
                      setBookForm({ ...bookForm, author: event.target.value })
                    }
                    maxLength="80"
                  />
                </div>
                <div className="two-fields">
                  <div>
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      value={bookForm.status}
                      onChange={(event) =>
                        setBookForm({ ...bookForm, status: event.target.value })
                      }
                    >
                      <option value="want to read">Want to read</option>
                      <option value="reading">Reading</option>
                      <option value="finished">Finished</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rating">Rating</label>
                    <select
                      id="rating"
                      value={bookForm.rating}
                      onChange={(event) =>
                        setBookForm({ ...bookForm, rating: event.target.value })
                      }
                    >
                      <option value="">None</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>
                  </div>
                </div>
                <button className="primary-button" disabled={busy}>
                  {busy ? "Adding" : "Add book"}
                </button>
              </form>

              <div className="summary">
                <div>
                  <span>Total</span>
                  <strong>{counts.all}</strong>
                </div>
                <div>
                  <span>Reading</span>
                  <strong>{counts.reading}</strong>
                </div>
                <div>
                  <span>Finished</span>
                  <strong>{counts.finished}</strong>
                </div>
              </div>
            </aside>

            <section className="books-area">
              <div className="tools">
                <div>
                  <label htmlFor="search">Search</label>
                  <input
                    id="search"
                    type="search"
                    placeholder="Search title or author"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="filter">Filter</label>
                  <select
                    id="filter"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option value="all">All books</option>
                    <option value="want to read">Want to read</option>
                    <option value="reading">Reading</option>
                    <option value="finished">Finished</option>
                  </select>
                </div>
              </div>

              {visibleBooks.length === 0 ? (
                <div className="empty">
                  <h2>{books.length === 0 ? "No books saved" : "No books found"}</h2>
                  <p>
                    {books.length === 0
                      ? "Add one book to see the CRUD flow working."
                      : "Try a different search or filter."}
                  </p>
                </div>
              ) : (
                <ul className="book-list">
                  {visibleBooks.map((book) => {
                    const isEditing = editingId === book._id;
                    const isBusy = busyBookId === book._id;

                    return (
                      <li className="book-row" key={book._id}>
                        {isEditing ? (
                          <div className="edit-form">
                            <div className="two-fields">
                              <div>
                                <label htmlFor={"editTitle" + book._id}>Title</label>
                                <input
                                  id={"editTitle" + book._id}
                                  value={editForm.title}
                                  onChange={(event) =>
                                    setEditForm({
                                      ...editForm,
                                      title: event.target.value,
                                    })
                                  }
                                  maxLength="120"
                                />
                              </div>
                              <div>
                                <label htmlFor={"editAuthor" + book._id}>Author</label>
                                <input
                                  id={"editAuthor" + book._id}
                                  value={editForm.author}
                                  onChange={(event) =>
                                    setEditForm({
                                      ...editForm,
                                      author: event.target.value,
                                    })
                                  }
                                  maxLength="80"
                                />
                              </div>
                            </div>
                            <div className="two-fields">
                              <div>
                                <label htmlFor={"editStatus" + book._id}>Status</label>
                                <select
                                  id={"editStatus" + book._id}
                                  value={editForm.status}
                                  onChange={(event) =>
                                    setEditForm({
                                      ...editForm,
                                      status: event.target.value,
                                    })
                                  }
                                >
                                  <option value="want to read">Want to read</option>
                                  <option value="reading">Reading</option>
                                  <option value="finished">Finished</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor={"editRating" + book._id}>Rating</label>
                                <select
                                  id={"editRating" + book._id}
                                  value={editForm.rating}
                                  onChange={(event) =>
                                    setEditForm({
                                      ...editForm,
                                      rating: event.target.value,
                                    })
                                  }
                                >
                                  <option value="">None</option>
                                  <option value="1">1</option>
                                  <option value="2">2</option>
                                  <option value="3">3</option>
                                  <option value="4">4</option>
                                  <option value="5">5</option>
                                </select>
                              </div>
                            </div>
                            <div className="row-actions">
                              <button
                                className="primary-button small"
                                type="button"
                                disabled={isBusy}
                                onClick={() => saveBook(book._id)}
                              >
                                {isBusy ? "Saving" : "Save"}
                              </button>
                              <button
                                className="text-button small"
                                type="button"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="book-info">
                              <h2>{book.title}</h2>
                              <p>{book.author}</p>
                              <div className="book-meta">
                                <select
                                  value={book.status}
                                  disabled={isBusy}
                                  onChange={(event) =>
                                    changeStatus(book, event.target.value)
                                  }
                                >
                                  <option value="want to read">Want to read</option>
                                  <option value="reading">Reading</option>
                                  <option value="finished">Finished</option>
                                </select>
                                <span>{book.rating ? book.rating + "/5" : "No rating"}</span>
                              </div>
                            </div>
                            <div className="row-actions">
                              <button
                                className="text-button small"
                                type="button"
                                onClick={() => startEdit(book)}
                              >
                                Edit
                              </button>
                              <button
                                className={
                                  deleteId === book._id
                                    ? "danger-button small"
                                    : "text-button small"
                                }
                                type="button"
                                disabled={isBusy}
                                onClick={() => removeBook(book._id)}
                              >
                                {deleteId === book._id ? "Confirm" : "Delete"}
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </section>
      )}

      {message && (
        <button
          className={"notice " + message.type}
          type="button"
          onClick={() => setMessage(null)}
        >
          {message.text}
        </button>
      )}
    </main>
  );
}

export default App;
