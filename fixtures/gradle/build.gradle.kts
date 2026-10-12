plugins { base }

val verifyRuntime = tasks.register("verifyRuntime") {
    doLast { check(JavaVersion.current() == JavaVersion.VERSION_25) }
}
tasks.check { dependsOn(verifyRuntime) }
