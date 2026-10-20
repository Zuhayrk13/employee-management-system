
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import date
import sqlite3
from pathlib import Path

app = Flask(__name__)
CORS(app)

DATABASE = Path(__file__).resolve().parent / "employees.db"


# Connect to the SQLite database
def get_db_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


# Create the table and add new columns when needed
def init_db():
    connection = get_db_connection()

    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                department TEXT NOT NULL
            )
        """)

        columns = {
            row["name"]
            for row in connection.execute(
                "PRAGMA table_info(employees)"
            ).fetchall()
        }

        if "first_name" not in columns:
            connection.execute(
                "ALTER TABLE employees ADD COLUMN first_name TEXT"
            )

        if "last_name" not in columns:
            connection.execute(
                "ALTER TABLE employees ADD COLUMN last_name TEXT"
            )

        if "status" not in columns:
            connection.execute("""
                ALTER TABLE employees
                ADD COLUMN status TEXT NOT NULL DEFAULT 'Active'
            """)

        if "date_of_birth" not in columns:
            connection.execute(
                "ALTER TABLE employees ADD COLUMN date_of_birth TEXT"
            )

        # Migrate existing full names into first and last names.
        rows = connection.execute("""
            SELECT id, name
            FROM employees
            WHERE first_name IS NULL OR last_name IS NULL
        """).fetchall()

        for row in rows:
            parts = row["name"].strip().split(maxsplit=1)
            first_name = parts[0] if parts else ""
            last_name = parts[1] if len(parts) > 1 else ""

            connection.execute("""
                UPDATE employees
                SET first_name = ?, last_name = ?
                WHERE id = ?
            """, (first_name, last_name, row["id"]))

        connection.commit()

    finally:
        connection.close()


# Validate employee data received from React
def validate_employee_data(data):
    if not isinstance(data, dict):
        return None, "Invalid request data"

    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    department = data.get("department")
    status = data.get("status", "Active")
    date_of_birth = data.get("date_of_birth")

    # Ensure all required fields are strings
    values = [first_name, last_name, email, department, date_of_birth]

    if not all(isinstance(value, str) for value in values):
        return None, "All fields are required"

    first_name = first_name.strip()
    last_name = last_name.strip()
    email = email.strip()
    department = department.strip()
    date_of_birth = date_of_birth.strip()

    if not all([
        first_name,
        last_name,
        email,
        department,
        date_of_birth
    ]):
        return None, "All fields are required"

    if not isinstance(status, str) or status not in ("Active", "Inactive"):
        return None, "Status must be Active or Inactive"

    try:
        dob = date.fromisoformat(date_of_birth)

        if dob.isoformat() != date_of_birth:
            raise ValueError

        if dob > date.today():
            return None, "Date of birth cannot be in the future"

    except ValueError:
        return None, "Please enter a valid date of birth"

    return {
        "first_name": first_name,
        "last_name": last_name,
        "name": f"{first_name} {last_name}",
        "email": email,
        "department": department,
        "status": status,
        "date_of_birth": date_of_birth,
    }, None


# Convert a database row into JSON-compatible data
def employee_to_dict(employee):
    return {
        "id": employee["id"],
        "first_name": employee["first_name"],
        "last_name": employee["last_name"],
        "email": employee["email"],
        "department": employee["department"],
        "status": employee["status"],
        "date_of_birth": employee["date_of_birth"],
    }


# Initialise the database when the application starts
init_db()


# Check whether the API is running
@app.get("/api/health")
def health_check():
    return jsonify({"status": "ok"})


# GET: Retrieve all employees
@app.get("/api/employees")
def get_employees():
    connection = get_db_connection()

    try:
        employees = connection.execute("""
            SELECT id, first_name, last_name, email,
                   department, status, date_of_birth
            FROM employees
            ORDER BY id DESC
        """).fetchall()

        return jsonify([
            employee_to_dict(employee)
            for employee in employees
        ])

    finally:
        connection.close()


# POST: Add a new employee
@app.post("/api/employees")
def add_employee():
    data = request.get_json(silent=True)
    employee, error = validate_employee_data(data)

    if error:
        return jsonify({"error": error}), 400

    connection = get_db_connection()

    try:
        cursor = connection.execute("""
            INSERT INTO employees (
                name, first_name, last_name, email,
                department, status, date_of_birth
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            employee["name"],
            employee["first_name"],
            employee["last_name"],
            employee["email"],
            employee["department"],
            employee["status"],
            employee["date_of_birth"],
        ))

        connection.commit()

        return jsonify({
            "message": "Employee added successfully",
            "id": cursor.lastrowid
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({"error": "This email already exists"}), 409

    finally:
        connection.close()


# PUT: Update an existing employee
@app.put("/api/employees/<int:employee_id>")
def update_employee(employee_id):
    data = request.get_json(silent=True)
    employee, error = validate_employee_data(data)

    if error:
        return jsonify({"error": error}), 400

    connection = get_db_connection()

    try:
        existing = connection.execute(
            "SELECT id FROM employees WHERE id = ?",
            (employee_id,)
        ).fetchone()

        if existing is None:
            return jsonify({"error": "Employee not found"}), 404

        connection.execute("""
            UPDATE employees
            SET name = ?,
                first_name = ?,
                last_name = ?,
                email = ?,
                department = ?,
                status = ?,
                date_of_birth = ?
            WHERE id = ?
        """, (
            employee["name"],
            employee["first_name"],
            employee["last_name"],
            employee["email"],
            employee["department"],
            employee["status"],
            employee["date_of_birth"],
            employee_id,
        ))

        connection.commit()

        return jsonify({
            "message": "Employee updated successfully"
        }), 200

    except sqlite3.IntegrityError:
        return jsonify({"error": "This email already exists"}), 409

    finally:
        connection.close()


# DELETE: Remove an employee
@app.delete("/api/employees/<int:employee_id>")
def delete_employee(employee_id):
    connection = get_db_connection()

    try:
        cursor = connection.execute(
            "DELETE FROM employees WHERE id = ?",
            (employee_id,)
        )

        if cursor.rowcount == 0:
            return jsonify({"error": "Employee not found"}), 404

        connection.commit()

        return jsonify({
            "message": "Employee deleted successfully"
        }), 200

    finally:
        connection.close()


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
