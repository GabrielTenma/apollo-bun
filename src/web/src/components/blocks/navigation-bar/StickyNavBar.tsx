// @ts-expect-error: side-effect import of logo
import logo from "@/assets/logo.png";

export default function StickyNavBar() {
	return (
		<nav className="navbar sticky bg-base-100 md:h-15 inset-s-0 top-0 z-50 shadow-base-300/20 shadow-sm">
			<div className="navbar-start"></div>
			<div className="navbar-end px-4 sm:px-6 lg:px-15">
				<img src={logo} alt="Logo" className="h-10 w-auto" />
			</div>
		</nav>
	);
}
