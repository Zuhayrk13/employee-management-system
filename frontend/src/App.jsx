import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "/api/employees";

const emptyForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  email: "",
  department: "",
  status: "Active",
};

function App() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const today = new Date();

  const latestEligibleDob = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate()
  );

  const maxDob = [
    latestEligibleDob.getFullYear(),
    String(latestEligibleDob.getMonth() + 1).padStart(2, "0"),
    String(latestEligibleDob.getDate()).padStart(2, "0"),
  ].join("-");

  async function fetchEmployees() {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load employees");
      }

      setEmployees(data);
      setError("");
    } catch (err) {
      setError(err.message || "Could not connect to Flask");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEmployees();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function startEditing(employee) {
    setEditingId(employee.id);

    setForm({
      first_name: employee.first_name || "",
      middle_name: employee.middle_name || "",
      last_name: employee.last_name || "",
      date_of_birth: employee.date_of_birth || "",
      email: employee.email || "",
      department: employee.department || "",
      status: employee.status || "Active",
    });

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const namePattern = /^[\p{L}]+(?:[ '-’][\p{L}]+)*$/u;

    if (!namePattern.test(form.first_name.trim())) {
      setError(
        "First name must contain letters only. Spaces, hyphens and apostrophes are allowed."
      );
      setMessage("");
      return;
    }

    if (
      form.middle_name.trim() &&
      !namePattern.test(form.middle_name.trim())
    ) {
      setError(
        "Middle name must contain letters only. Spaces, hyphens and apostrophes are allowed."
      );
      setMessage("");
      return;
    }

    if (!namePattern.test(form.last_name.trim())) {
      setError(
        "Last name must contain letters only. Spaces, hyphens and apostrophes are allowed."
      );
      setMessage("");
      return;
    }

    const email = form.email.trim();
    const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

    if (!emailPattern.test(email)) {
      setError(
        "Please enter a valid email address using lowercase letters only."
      );
      setMessage("");
      return;
    }

    if (!form.date_of_birth) {
      setError("Please enter a date of birth.");
      setMessage("");
      return;
    }

    const dob = new Date(`${form.date_of_birth}T00:00:00`);
    const today = new Date();

    const eighteenthBirthday = new Date(
      dob.getFullYear() + 18,
      dob.getMonth(),
      dob.getDate()
    );

    if (Number.isNaN(dob.getTime()) || eighteenthBirthday > today) {
      setError("Employee must be at least 18 years old.");
      setMessage("");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const isEditing = editingId !== null;

      const payload = {
        ...form,
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim(),
        last_name: form.last_name.trim(),
        email,
        department: form.department.trim(),
      };

      const response = await fetch(
        isEditing ? `${API_URL}/${editingId}` : API_URL,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The request failed");
      }

      setForm({ ...emptyForm });
      setEditingId(null);

      await fetchEmployees();
      setMessage(
        isEditing
          ? "Employee updated successfully."
          : "Employee added successfully."
      );
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(employee) {
    const employeeName = [
      employee.first_name,
      employee.middle_name,
      employee.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const confirmed = window.confirm(
      `Are you sure you want to delete ${employeeName}?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const response = await fetch(`${API_URL}/${employee.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete employee");
      }

      if (editingId === employee.id) {
        cancelEditing();
      }

      await fetchEmployees();
      setMessage("Employee deleted successfully.");
    } catch (err) {
      setError(err.message || "Could not delete employee");
    }
  }

  const activeCount = employees.filter(
    (employee) => employee.status === "Active"
  ).length;

  const inactiveCount = employees.filter(
    (employee) => employee.status === "Inactive"
  ).length;

  const filteredEmployees = employees.filter((employee) => {
    const fullName = [
      employee.first_name || "",
      employee.middle_name || "",
      employee.last_name || "",
    ]
      .join(" ")
      .toLowerCase();

    const searchText = search.toLowerCase();

    const matchesSearch =
      fullName.includes(searchText) ||
      (employee.email || "").toLowerCase().includes(searchText) ||
      (employee.department || "").toLowerCase().includes(searchText);

    const matchesStatus =
      statusFilter === "All" || employee.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">P</div>
          <div>
            <h1>PeopleDesk</h1>
            <p>Employee Management System</p>
          </div>
        </div>

        <div className="topbar-right">
          <span className="system-indicator"></span>
          System Dashboard
        </div>
      </header>

      <section className="welcome-section">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h2>Employee Dashboard</h2>
          <p className="muted">
            Manage employee information and keep your directory organised.
          </p>
        </div>

        <div className="date-label">
          <span>EMPLOYEE DIRECTORY</span>
          <strong>{employees.length} total records</strong>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-icon total-icon">◎</div>
          <p>Total Employees</p>
          <strong>{employees.length}</strong>
          <span className="stat-note">All employee records</span>
        </article>

        <article className="stat-card">
          <div className="stat-icon active-icon">✓</div>
          <p>Active Employees</p>
          <strong>{activeCount}</strong>
          <span className="stat-note">Currently active</span>
        </article>

        <article className="stat-card">
          <div className="stat-icon inactive-icon">Ⅱ</div>
          <p>Inactive Employees</p>
          <strong>{inactiveCount}</strong>
          <span className="stat-note">Currently inactive</span>
        </article>
      </section>

      <section className="employee-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EMPLOYEE DETAILS</p>
            <h2>
              {editingId !== null ? "Edit Employee" : "Add New Employee"}
            </h2>
            <p className="muted">
              {editingId !== null
                ? "Update the employee's information."
                : "Fill in the details below to add a new employee."}
            </p>
          </div>

          {editingId !== null && (
            <span className="editing-badge">Editing #{editingId}</span>
          )}
        </div>

        <form className="employee-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="first_name">First Name</label>
            <input
              id="first_name"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              placeholder="e.g. Alex"
              autoComplete="given-name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="middle_name">
              Middle Name <span className="muted">(Optional)</span>
            </label>
            <input
              id="middle_name"
              name="middle_name"
              value={form.middle_name}
              onChange={handleChange}
              placeholder="e.g. James"
              autoComplete="additional-name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="last_name">Last Name</label>
            <input
              id="last_name"
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              placeholder="e.g. Brown"
              autoComplete="family-name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="date_of_birth">Date of Birth</label>
            <input
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              value={form.date_of_birth}
              onChange={handleChange}
              max={maxDob}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="alex@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="department">Department</label>
            <input
              id="department"
              name="department"
              value={form.department}
              onChange={handleChange}
              placeholder="e.g. Information Technology"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">Employment Status</label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Saving..."
                : editingId !== null
                  ? "Save Changes"
                  : "+ Add Employee"}
            </button>

            {editingId !== null && (
              <button
                className="secondary-button"
                type="button"
                onClick={cancelEditing}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {error && <p className="feedback error">{error}</p>}
        {message && <p className="feedback success">{message}</p>}
      </section>

      <section className="employee-section directory-section">
        <div className="section-heading directory-heading">
          <div>
            <p className="eyebrow">PEOPLE</p>
            <h2>Employee Directory</h2>
            <p className="muted">
              Search, filter, and manage your employee records.
            </p>
          </div>

          <span className="record-count">
            {filteredEmployees.length} shown
          </span>
        </div>

        <div className="directory-controls">
          <div className="search-box">
            <span>⌕</span>
            <input
              type="search"
              aria-label="Search employees"
              placeholder="Search name, email, or department..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="filter-buttons" aria-label="Filter by status">
            {["All", "Active", "Inactive"].map((status) => (
              <button
                key={status}
                type="button"
                className={`filter-button ${
                  statusFilter === status ? "selected" : ""
                }`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="empty-state">Loading employees...</p>
        ) : error && employees.length === 0 ? (
          <p className="empty-state">
            Could not load employees. Check whether Flask is running.
          </p>
        ) : filteredEmployees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⌕</div>
            <strong>No employees found</strong>
            <p>Try changing your search or status filter.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>DATE OF BIRTH</th>
                  <th>EMAIL ADDRESS</th>
                  <th>DEPARTMENT</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee) => {
                  const fullName = [
                    employee.first_name,
                    employee.middle_name,
                    employee.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <tr key={employee.id}>
                      <td>
                        <div className="employee-identity">
                          <div className="avatar">
                            {(employee.first_name || "?")
                              .charAt(0)
                              .toUpperCase()}
                            {(employee.last_name || "")
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>{fullName}</strong>
                            <span>Employee #{employee.id}</span>
                          </div>
                        </div>
                      </td>

                      <td>{employee.date_of_birth || "—"}</td>
                      <td>{employee.email}</td>

                      <td>
                        <span className="department-label">
                          {employee.department}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            employee.status === "Active"
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          <span className="status-dot"></span>
                          {employee.status}
                        </span>
                      </td>

                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="edit-button"
                            onClick={() => startEditing(employee)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => handleDelete(employee)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="app-footer">
        <span>PeopleDesk · Employee Management</span>
        <span>Built with React &amp; Flask</span>
      </footer>
    </main>
  );
}

export default App;

