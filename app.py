import os
from datetime import datetime
from flask import Flask, redirect, render_template, request, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user
from flask_admin import Admin
from flask_admin.theme import Bootstrap4Theme

from extensions import db, login_manager
import models as m
from admin_views import register_all_views, DashboardIndexView
import i18n
from i18n import L


def build_stats():
    """Group table counts by module for the dashboard cards, filtered to
    only the modules the current user is permitted to view."""
    groups = [
        ("Geography & Institutions", "purple", "geography.view", [
            ("Governorates", m.Governorate, "governorate.index_view"),
            ("Districts", m.District, "district.index_view"),
            ("Offices", m.Office, "office.index_view"),
            ("Departments", m.Department, "department.index_view"),
            ("Courts", m.Court, "court.index_view"),
            ("Religious Authorities", m.ReligiousAuthority, "religiousauthority.index_view"),
            ("Mukhtars", m.Mukhtar, "mukhtar.index_view"),
        ]),
        ("Access Control & Security", "gold", "access_control.view", [
            ("Permissions", m.Permission, "permission.index_view"),
            ("Roles", m.Role, "role.index_view"),
            ("Role ↔ Permissions", m.RolePermission, "rolepermission.index_view"),
            ("Users", m.User, "user.index_view"),
            ("User ↔ Roles", m.UserRole, "userrole.index_view"),
        ]),
        ("Security & Sessions", "gray", "security.view", [
            ("Session Logs", m.SessionLog, "sessionlog.index_view"),
            ("Login Attempts", m.LoginAttempt, "loginattempt.index_view"),
            ("Token Denylist", m.TokenDenylist, "tokendenylist.index_view"),
        ]),
        ("Workflow Configuration", "orange", "workflow.view", [
            ("Workflow States", m.WorkflowState, "workflowstate.index_view"),
            ("Workflow Transitions", m.WorkflowTransition, "workflowtransition.index_view"),
            ("Transition Permissions", m.WorkflowTransitionPermission, "workflowtransitionpermission.index_view"),
        ]),
        ("Document Configuration", "blue", "documents.view", [
            ("Document Types", m.DocumentType, "documenttype.index_view"),
            ("Document Type Authorities", m.DocumentTypeAuthority, "documenttypeauthority.index_view"),
        ]),
        ("Citizens & Family", "pink", "citizens.view", [
            ("Citizens", m.Citizen, "citizen.index_view"),
            ("Family Records", m.FamilyRecord, "familyrecord.index_view"),
            ("Family Members", m.FamilyMember, "familymember.index_view"),
            ("Guardianship Records", m.GuardianshipRecord, "guardianshiprecord.index_view"),
            ("Registry Transfers", m.RegistryTransfer, "registrytransfer.index_view"),
            ("Civil Status Amendments", m.CivilStatusAmendment, "civilstatusamendment.index_view"),
        ]),
        ("Documents", "blue", "documents.view", [
            ("Documents", m.Document, "document.index_view"),
            ("Document Validations", m.DocumentValidation, "documentvalidation.index_view"),
            ("Physical Handling", m.PhysicalDocumentHandling, "physicaldocumenthandling.index_view"),
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
        ("Service Requests & Payments", "red", "requests.view", [
            ("Service Requests", m.ServiceRequest, "servicerequest.index_view"),
            ("Request Assignments", m.RequestAssignment, "requestassignment.index_view"),
            ("Status History", m.ServiceRequestStatusHistory, "servicerequeststatushistory.index_view"),
            ("SLA Records", m.SlaRecord, "slarecord.index_view"),
            ("Payments", m.Payment, "payment.index_view"),
            ("Notifications", m.InternalNotification, "internalnotification.index_view"),
        ]),
        ("Audit & Access Logs", "gray", "audit.view", [
            ("Audit Logs", m.AuditLog, "auditlog.index_view"),
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
    if app.config["SECRET_KEY"] == "dev-secret-change-me":
        # Fine for local/demo use (matches the "zero external setup" README
        # promise); just make sure it doesn't go unnoticed before a real
        # deployment. Set SECRET_KEY explicitly once this leaves your laptop.
        print("WARNING: using the default SECRET_KEY. Set the SECRET_KEY env var before deploying.")

    db.init_app(app)

    # Language toggle, Arabic/English text, RTL direction, and (if flask-babel
    # is installed) Flask-Admin's own Arabic catalogue. Registered before the
    # admin so the menu labels can translate per request.
    i18n.register(app)

    login_manager.init_app(app)
    login_manager.login_view = "login_page"
    login_manager.login_message = "Please log in to access the Civil Registry system."
    login_manager.login_message_category = "info"

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(m.User, int(user_id))

    admin = Admin(
        app,
        name="CTS — Civil Registry",
        theme=Bootstrap4Theme(swatch="cerulean" , fluid=True),
        index_view=DashboardIndexView(name=L("Dashboard")),
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

            attempt = m.LoginAttempt(
                username_attempted=username,
                user_id=user.id if user else None,
                ip_address=request.remote_addr,
                user_agent=request.headers.get("User-Agent", "")[:255],
            )

            if user and user.is_active and user.check_password(password):
                attempt.was_successful = True
                db.session.add(attempt)
                user.last_login_at = datetime.utcnow()
                db.session.commit()
                login_user(user)
                flash(f"Welcome, {user.first_name} {user.last_name}.", "success")
                next_url = request.args.get("next") or url_for("admin.index")
                return redirect(next_url)

            attempt.was_successful = False
            attempt.failure_reason = "UNKNOWN_USER" if not user else (
                "ACCOUNT_INACTIVE" if not user.is_active else "BAD_PASSWORD"
            )
            db.session.add(attempt)
            db.session.commit()
            flash("Invalid username or password.", "error")

        return render_template("login.html")

    @app.route("/logout")
    @login_required
    def logout():
        logout_user()
        flash("You have been signed out. · تم تسجيل خروجك.", "info")
        return redirect(url_for("login_page"))

    @app.route("/switch-account")
    @login_required
    def switch_account():
        """Sign out and return to the login form, ready for a different user.

        Mechanically this ends the session exactly as /logout does — Flask-Login
        holds one identity per browser session, so there is no way to "add" a
        second account without ending the first. It exists as its own route so
        the message the user lands on matches the button they pressed: a clerk
        handing the terminal to a colleague is told to sign in, not told they
        have been logged out.
        """
        logout_user()
        flash("Signed out. Sign in with another account. · سجّل الدخول بحساب آخر.", "info")
        return redirect(url_for("login_page"))

    with app.app_context():
        db.create_all()

    return app


app = create_app()

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(debug=debug_mode, host="0.0.0.0", port=5000)