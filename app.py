import os
from flask import Flask, redirect, render_template, request, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user
from flask_admin import Admin
from flask_admin.theme import Bootstrap4Theme

from extensions import db, login_manager
import models as m
from admin_views import register_all_views, DashboardIndexView


def build_stats():
    """Group table counts by module for the dashboard cards, filtered to
    only the modules the current user is permitted to view."""
    groups = [
        ("Geography & Institutions", "purple", "geography.view", [
            ("Governorates", m.Governorate, "governorate.index_view"),
            ("Districts", m.District, "district.index_view"),
            ("Offices", m.Office, "office.index_view"),
            ("Courts", m.Court, "court.index_view"),
            ("Religious Authorities", m.ReligiousAuthority, "religiousauthority.index_view"),
        ]),
        ("Access Control", "gold", "access_control.view", [
            ("Permissions", m.Permission, "permission.index_view"),
            ("Roles", m.Role, "role.index_view"),
            ("Role ↔ Permissions", m.RolePermission, "rolepermission.index_view"),
            ("Users", m.User, "user.index_view"),
            ("User ↔ Roles", m.UserRole, "userrole.index_view"),
        ]),
        ("Citizens & Family", "orange", "citizens.view", [
            ("Citizens", m.Citizen, "citizen.index_view"),
            ("Family Records", m.FamilyRecord, "familyrecord.index_view"),
            ("Family Members", m.FamilyMember, "familymember.index_view"),
        ]),
        ("Documents", "teal", "documents.view", [
            ("Document Types", m.DocumentType, "documenttype.index_view"),
            ("Documents", m.Document, "document.index_view"),
        ]),
        ("Certificates", "green", "certificates.view", [
            ("Birth Certificates", m.BirthCertificate, "birthcertificate.index_view"),
            ("Marriage Certificates", m.MarriageCertificate, "marriagecertificate.index_view"),
            ("Divorce Certificates", m.DivorceCertificate, "divorcecertificate.index_view"),
            ("Death Certificates", m.DeathCertificate, "deathcertificate.index_view"),
            ("National ID Cards", m.NationalIdCard, "nationalidcard.index_view"),
            ("Passports", m.Passport, "passport.index_view"),
            ("Naturalization Records", m.NaturalizationRecord, "naturalizationrecord.index_view"),
            ("Name Change Records", m.NameChangeRecord, "namechangerecord.index_view"),
        ]),
        ("Audit & Workflow", "gray", "audit.view", [
            ("Document Validations", m.DocumentValidation, "documentvalidation.index_view"),
            ("Physical Handling", m.PhysicalDocumentHandling, "physicaldocumenthandling.index_view"),
            ("Service Requests", m.ServiceRequest, "servicerequest.index_view"),
            ("Citizen Audit Log", m.CitizenAuditLog, "citizenauditlog.index_view"),
            ("Record Access Log", m.RecordAccessLog, "recordaccesslog.index_view"),
        ]),
    ]

    result = []
    for title, color, required_perm, items in groups:
        if not current_user.is_authenticated or not current_user.has_permission(required_perm):
            continue
        rows = []
        for label, model, endpoint in items:
            try:
                count = db.session.query(model).count()
            except Exception:
                count = 0
            rows.append({"label": label, "count": count, "endpoint": endpoint})
        result.append({"title": title, "color": color, "rows": rows})
    return result


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "sqlite:///" + os.path.join(os.path.dirname(__file__), "moi_registry.db")
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")

    db.init_app(app)

    login_manager.init_app(app)
    login_manager.login_view = "login_page"
    login_manager.login_message = "Please log in to access the Civil Registry system."
    login_manager.login_message_category = "info"

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(m.User, user_id)

    admin = Admin(
        app,
        name="MOI Civil Registry",
        theme=Bootstrap4Theme(swatch="cerulean"),
        index_view=DashboardIndexView(name="Dashboard"),
    )

    register_all_views(admin)

    @app.route("/")
    def root():
        return redirect("/admin/")

    @app.route("/login", methods=["GET", "POST"])
    def login_page():
        if current_user.is_authenticated:
            return redirect(url_for("admin.index"))

        if request.method == "POST":
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "")
            user = m.User.query.filter_by(username=username).first()

            if user and user.active and user.check_password(password):
                login_user(user)
                flash(f"Welcome, {user.first_name} {user.last_name}.", "success")
                next_url = request.args.get("next") or url_for("admin.index")
                return redirect(next_url)

            flash("Invalid username or password.", "error")

        return render_template("login.html")

    @app.route("/logout")
    @login_required
    def logout():
        logout_user()
        flash("You have been logged out.", "info")
        return redirect(url_for("login_page"))

    with app.app_context():
        db.create_all()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
