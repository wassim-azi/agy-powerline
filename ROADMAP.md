# Roadmap

What agy-powerline plans for the year to October 2027. Plans can change; the [issues](https://github.com/wassim-azi/agy-powerline/issues) labelled `enhancement` are the up-to-date list, and [Discussions](https://github.com/wassim-azi/agy-powerline/discussions) is the place to suggest something.

## Planned

Feature enhancements are tracked in [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues) labelled `enhancement`.

### Reliability and contributors

- **Keeping up with agy**: support for new fields in the session JSON as new agy versions send them, each tested against a captured payload in `tests/fixtures/`.
- **One module per widget**: today a widget touches eight files; one module rendered by both layouts makes adding a widget a one-file pull request.
- **Security practices**: the OpenSSF Best Practices Silver badge, and a second maintainer so that every change gets a review by someone other than its author.

## Not planned

These stay out, because they would break the [hard rules](AGENTS.md#hard-rules) that protect users' machines:

- runtime dependencies;
- network calls or telemetry;
- reading config from the current directory.
